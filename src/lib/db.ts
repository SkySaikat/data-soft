import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  BUDGETS,
  conservativeBudget,
  identityKey,
  scoreLead,
  type Budget,
  type CollectionRun,
  type Evidence,
  type Filters,
  type Lead,
  type LeadInput,
  type LeadPage,
  type Source,
  type Workspace,
  type PublicContact,
  type WorkJob,
  type OutboundMessage,
} from "./domain";
import { demoLeads } from "./demo";

type Row = Record<string, unknown>;
function hydrate(row: Row): Lead {
  return {
    ...JSON.parse(row.data as string),
    id: row.id,
    workspace: row.workspace,
    status: row.status,
    confirmedBudget: row.confirmed_budget,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: JSON.parse(row.evidence as string),
  };
}

export class Repository {
  readonly db: DatabaseSync;
  constructor(path: string, seedDemo = true) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY, workspace TEXT NOT NULL, identity_key TEXT NOT NULL,
        name TEXT NOT NULL, industry TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL,
        budget TEXT NOT NULL, score INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new',
        confirmed_budget REAL, data TEXT NOT NULL, evidence TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(workspace, identity_key)
      );
      CREATE INDEX IF NOT EXISTS leads_filters ON leads(workspace,state,industry,budget,score);
      CREATE TABLE IF NOT EXISTS source_links (workspace TEXT NOT NULL, source TEXT NOT NULL, record_key TEXT NOT NULL, lead_id TEXT NOT NULL REFERENCES leads(id), PRIMARY KEY(workspace,source,record_key));
      CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, family TEXT NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL, description TEXT NOT NULL, imported INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS collection_runs (id TEXT PRIMARY KEY, source TEXT NOT NULL, state TEXT NOT NULL, city TEXT NOT NULL, status TEXT NOT NULL, imported INTEGER NOT NULL, updated INTEGER NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), mode TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS budget_confirmations (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), amount REAL, note TEXT NOT NULL, recorded_by TEXT NOT NULL, confirmed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ai_usage (id TEXT PRIMARY KEY, month TEXT NOT NULL, reserved REAL NOT NULL, actual REAL, state TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS public_contacts (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), kind TEXT NOT NULL, value TEXT NOT NULL, source_url TEXT NOT NULL, found_at TEXT NOT NULL, status TEXT NOT NULL, e164 TEXT NOT NULL DEFAULT '', phone_type TEXT NOT NULL DEFAULT 'unknown', UNIQUE(lead_id,kind,value));
      CREATE INDEX IF NOT EXISTS contacts_lead ON public_contacts(lead_id);
      CREATE TABLE IF NOT EXISTS work_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_cache (cache_key TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_locks (lock_key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS usage_counters (counter_key TEXT PRIMARY KEY, amount INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS suppressions (email TEXT PRIMARY KEY, reason TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS contact_reviews (lead_id TEXT NOT NULL REFERENCES leads(id), email TEXT NOT NULL, note TEXT NOT NULL, reviewed_at TEXT NOT NULL, expires_at TEXT NOT NULL, PRIMARY KEY(lead_id,email));
      CREATE TABLE IF NOT EXISTS outbound_messages (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, content_hash TEXT NOT NULL, status TEXT NOT NULL, provider_id TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, sent_at TEXT);
      CREATE INDEX IF NOT EXISTS message_recipient ON outbound_messages(recipient,created_at);
      CREATE INDEX IF NOT EXISTS message_hash ON outbound_messages(content_hash,created_at);
      PRAGMA user_version=2;`);
    const sourceSeeds = [
      ["osm", "OpenStreetMap local businesses", "Open business listings", "https://www.openstreetmap.org/copyright", "available", "Plumbers, electricians, lawyers, real estate and other businesses. Bounded city-area searches; © OpenStreetMap contributors, ODbL 1.0."],
      ["website", "Business website enrichment", "Public business contacts", "", "available", "Read permitted homepage/contact pages for public emails and phones. Source evidence is retained; no email guessing."],
      [
        "csv",
        "CSV & manual import",
        "Import",
        "",
        "available",
        "Import business listings you are authorized to use. No paid API required.",
      ],
      [
        "nppes",
        "NPPES healthcare directory",
        "Public directory",
        "https://npiregistry.cms.hhs.gov/api-page",
        "available",
        "Collect public organization/practice listings by state and city. No patient data.",
      ],
      [
        "directory",
        "Approved website directory",
        "Business listings",
        "",
        "permission_required",
        "Collect structured LocalBusiness listings from a directory you are authorized to access.",
      ],
      [
        "chamber",
        "Chamber member directories",
        "Local membership",
        "https://www.austinchamber.com/membership/our-members",
        "candidate",
        "Candidate source. Automated collection rights have not been established.",
      ],
      [
        "bbb",
        "Better Business Bureau",
        "Business listings",
        "https://www.bbb.org/Search",
        "candidate",
        "Candidate only. An appropriate permission or licensed feed is required.",
      ],
      [
        "yp",
        "Yellow Pages",
        "Business listings",
        "https://www.yellowpages.com/",
        "candidate",
        "Candidate only. Bulk access and reuse rights need review.",
      ],
    ];
    const insertSource = this.db.prepare(
      "INSERT OR IGNORE INTO sources(id,name,family,url,status,description) VALUES(?,?,?,?,?,?)",
    );
    for (const source of sourceSeeds) insertSource.run(...source);
    if (
      seedDemo &&
      !this.db
        .prepare("SELECT 1 FROM leads WHERE workspace='demo' LIMIT 1")
        .get()
    )
      this.upsertMany(demoLeads, "demo");
  }
  close() {
    this.db.close();
  }
  upsertMany(inputs: LeadInput[], workspace: Workspace) {
    let imported = 0,
      updated = 0;
    const ids: string[] = [];
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const input of inputs) {
        const key = identityKey(input);
        const linked = input.sourceRecordId
          ? this.db
              .prepare(
                "SELECT lead_id FROM source_links WHERE workspace=? AND source=? AND record_key=?",
              )
              .get(workspace, input.sourceName, input.sourceRecordId)
          : undefined;
        const existing = linked
          ? this.db
              .prepare("SELECT * FROM leads WHERE id=? AND workspace=?")
              .get(linked.lead_id as string, workspace)
          : this.db
              .prepare(
                "SELECT * FROM leads WHERE workspace=? AND identity_key=?",
              )
              .get(workspace, key);
        const now = new Date().toISOString();
        const id = existing ? (existing.id as string) : randomUUID();
        const old = existing ? hydrate(existing) : undefined;
        const combined = {
          ...input,
          website: input.website || old?.website || "",
          email: input.email || old?.email || "",
          phone: input.phone || old?.phone || "",
          notes: input.notes || old?.notes || "",
          services: [...new Set([...(old?.services || []), ...input.services])],
        };
        const budgetInput =
          input.budget === "unknown" && old
            ? {
                ...combined,
                budget: old.budget,
                budgetEvidence: old.budgetEvidence,
              }
            : combined;
        const data = {
          ...budgetInput,
          ...conservativeBudget(budgetInput),
          score: scoreLead(combined),
        };
        const evidence: Evidence = {
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl,
          observedAt: now,
          detail:
            input.notes ||
            "Business details imported; service needs require review.",
        };
        const evidenceList = [
          ...(old?.evidence || []).filter(
            (e) =>
              e.sourceName !== evidence.sourceName ||
              e.sourceUrl !== evidence.sourceUrl,
          ),
          evidence,
        ].slice(-20);
        if (existing) {
          this.db
            .prepare(
              "UPDATE leads SET name=?,industry=?,city=?,state=?,budget=?,score=?,data=?,evidence=?,updated_at=? WHERE id=? AND workspace=?",
            )
            .run(
              data.name,
              data.industry,
              data.city,
              data.state,
              data.budget,
              data.score,
              JSON.stringify(data),
              JSON.stringify(evidenceList),
              now,
              id,
              workspace,
            );
          updated++;
        } else {
          this.db
            .prepare(
              "INSERT INTO leads(id,workspace,identity_key,name,industry,city,state,budget,score,data,evidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            )
            .run(
              id,
              workspace,
              key,
              data.name,
              data.industry,
              data.city,
              data.state,
              data.budget,
              data.score,
              JSON.stringify(data),
              JSON.stringify(evidenceList),
              now,
              now,
            );
          imported++;
        }
        if (input.sourceRecordId)
          this.db
            .prepare(
              "INSERT INTO source_links(workspace,source,record_key,lead_id) VALUES(?,?,?,?) ON CONFLICT(workspace,source,record_key) DO UPDATE SET lead_id=excluded.lead_id",
            )
            .run(workspace, input.sourceName, input.sourceRecordId, id);
        ids.push(id);
        for (const [kind,value] of [["email",input.email],["phone",input.phone]] as const) if (value) this.addContact(id,{kind,value,sourceUrl:input.sourceUrl,status:"imported"});
      }
      this.db.exec("COMMIT");
      return { imported, updated, ids };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  getLead(id: string, workspace: Workspace) {
    const row = this.db
      .prepare("SELECT * FROM leads WHERE id=? AND workspace=?")
      .get(id, workspace);
    if (!row) return null;
    const lead = hydrate(row);
    lead.contacts = this.contacts(id);
    lead.emailSuppressed = lead.email ? this.isSuppressed(lead.email) : false;
    return lead;
  }
  updateLead(
    id: string,
    workspace: Workspace,
    patch: {
      status?: string;
      confirmedBudget?: number | null;
      confirmedBudgetNote?: string;
    },
  ) {
    const lead = this.getLead(id, workspace);
    if (!lead) return null;
    if (
      patch.confirmedBudget != null &&
      (!patch.confirmedBudgetNote ||
        patch.confirmedBudgetNote.trim().length < 3)
    )
      throw new Error(
        "Record who confirmed the budget, when, and what it covers.",
      );
    if (patch.status)
      this.db
        .prepare(
          "UPDATE leads SET status=?,updated_at=? WHERE id=? AND workspace=?",
        )
        .run(patch.status, new Date().toISOString(), id, workspace);
    if (patch.confirmedBudget !== undefined) {
      const now = new Date().toISOString(),
        note =
          patch.confirmedBudgetNote?.trim() ||
          "Confirmed budget cleared by local owner.";
      const evidence = [
        ...lead.evidence,
        {
          sourceName: "Prospect budget confirmation · owner entry",
          sourceUrl: "",
          observedAt: now,
          detail: `${patch.confirmedBudget === null ? "Budget cleared" : `$${patch.confirmedBudget}/month in agency service fees`}. ${note}`,
        },
      ];
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db
          .prepare(
            "UPDATE leads SET confirmed_budget=?,evidence=?,updated_at=? WHERE id=? AND workspace=?",
          )
          .run(
            patch.confirmedBudget,
            JSON.stringify(evidence),
            now,
            id,
            workspace,
          );
        this.db
          .prepare("INSERT INTO budget_confirmations VALUES(?,?,?,?,?,?)")
          .run(
            randomUUID(),
            id,
            patch.confirmedBudget,
            note,
            "Local workspace owner",
            now,
          );
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
    return this.getLead(id, workspace);
  }
  list(
    workspace: Workspace,
    filters: Filters = {},
    exportAll = false,
  ): LeadPage {
    const clauses = ["workspace=?"];
    const values: (string | number)[] = [workspace];
    for (const key of ["state", "industry", "budget", "status"] as const)
      if (filters[key]) {
        clauses.push(`${key}=?`);
        values.push(filters[key]!);
      }
    if (filters.city) {
      clauses.push("city LIKE ? ESCAPE '\\'");
      values.push(`%${escapeLike(filters.city)}%`);
    }
    if (filters.q) {
      clauses.push(
        "(name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR industry LIKE ? ESCAPE '\\')",
      );
      const search = `%${escapeLike(filters.q)}%`;
      values.push(search, search, search);
    }
    if (filters.service) {
      clauses.push(
        "EXISTS (SELECT 1 FROM json_each(leads.data,'$.services') WHERE value=?)",
      );
      values.push(filters.service);
    }
    if (filters.ids) {
      const ids = filters.ids.split(",").filter(Boolean).slice(0, 10000);
      if (ids.length) {
        clauses.push(`id IN (SELECT value FROM json_each(?))`);
        values.push(JSON.stringify(ids));
      }
    }
    const where = clauses.join(" AND ");
    const page = Math.max(
      1,
      Math.min(Number.parseInt(filters.page || "1") || 1, 100000),
    );
    const order =
      filters.sort === "name"
        ? "name COLLATE NOCASE"
        : filters.sort === "recent"
          ? "created_at DESC"
          : "score DESC,name COLLATE NOCASE";
    const total = Number(
      this.db
        .prepare(`SELECT count(*) n FROM leads WHERE ${where}`)
        .get(...values)!.n,
    );
    const pageSize = filters.pageSize === "all" ? Math.max(1,total) : Math.max(1,Math.min(10000,Number.parseInt(filters.pageSize || "100") || 100));
    const rows = this.db
      .prepare(
        `SELECT * FROM leads WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(
        ...values,
        exportAll ? -1 : pageSize,
        exportAll ? 0 : (page - 1) * pageSize,
      );
    const grouped = this.db.prepare("SELECT budget,count(*) n FROM leads WHERE workspace=? GROUP BY budget").all(workspace);
    const budgets = Object.fromEntries(
      Object.keys(BUDGETS).map((b) => [b, 0]),
    ) as Record<Budget, number>;
    for (const row of grouped) budgets[row.budget as Budget] = Number(row.n);
    const stats = this.db.prepare("SELECT count(*) total,count(DISTINCT industry) industries,sum(CASE WHEN score>=70 THEN 1 ELSE 0 END) high_priority,sum(CASE WHEN coalesce(json_extract(data,'$.email'),'')!='' OR coalesce(json_extract(data,'$.phone'),'')!='' THEN 1 ELSE 0 END) contactable FROM leads WHERE workspace=?").get(workspace)!;
    const leads=rows.map(hydrate);
    const contacts=this.db.prepare("SELECT id,lead_id AS leadId,kind,value,source_url AS sourceUrl,found_at AS foundAt,status,e164,phone_type AS phoneType FROM public_contacts WHERE lead_id IN (SELECT value FROM json_each(?))").all(JSON.stringify(leads.map(l=>l.id))) as unknown as PublicContact[];
    const byLead=new Map<string,PublicContact[]>();for(const contact of contacts)byLead.set(contact.leadId,[...(byLead.get(contact.leadId)||[]),contact]);
    const suppressed=new Set(this.db.prepare("SELECT email FROM suppressions").all().map(row=>row.email as string));
    for(const lead of leads){lead.contacts=byLead.get(lead.id)||[];lead.emailSuppressed=suppressed.has(lead.email.toLowerCase());}
    return {
      leads,
      total,
      page,
      pageSize,
      summary: {
        total: Number(stats.total),
        highPriority: Number(stats.high_priority || 0),
        contactable: Number(stats.contactable || 0),
        industries: Number(stats.industries),
        budgets,
      },
      industries: this.db
        .prepare(
          "SELECT DISTINCT industry FROM leads WHERE workspace=? ORDER BY industry",
        )
        .all(workspace)
        .map((r) => r.industry as string),
      cities: this.db
        .prepare(
          "SELECT DISTINCT city FROM leads WHERE workspace=? ORDER BY city",
        )
        .all(workspace)
        .map((r) => r.city as string),
    };
  }
  sources(): Source[] {
    return this.db
      .prepare("SELECT * FROM sources")
      .all() as unknown as Source[];
  }
  runs(): CollectionRun[] {
    return this.db
      .prepare(
        "SELECT * FROM collection_runs ORDER BY created_at DESC LIMIT 30",
      )
      .all()
      .map((row) => ({
        ...row,
        createdAt: row.created_at,
      })) as unknown as CollectionRun[];
  }
  recordRun(run: Omit<CollectionRun, "id" | "createdAt">) {
    this.db
      .prepare("INSERT INTO collection_runs VALUES(?,?,?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        run.source,
        run.state,
        run.city,
        run.status,
        run.imported,
        run.updated,
        run.message,
        new Date().toISOString(),
      );
  }
  incrementSource(id: string, amount: number) {
    this.db
      .prepare("UPDATE sources SET imported=imported+? WHERE id=?")
      .run(amount, id);
  }
  saveAnalysis(leadId: string, mode: string, data: unknown) {
    this.db
      .prepare("INSERT INTO analyses VALUES(?,?,?,?,?)")
      .run(
        randomUUID(),
        leadId,
        mode,
        JSON.stringify(data),
        new Date().toISOString(),
      );
  }
  reserveAi(amount: number, cap: number) {
    const month = new Date().toISOString().slice(0, 7),
      id = randomUUID();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const spent = Number(
        this.db
          .prepare(
            "SELECT coalesce(sum(CASE WHEN actual IS NULL THEN reserved ELSE actual END),0) spent FROM ai_usage WHERE month=?",
          )
          .get(month)!.spent,
      );
      if (spent + amount > cap)
        throw new Error(
          "Monthly AI budget reached. Local analysis is still available.",
        );
      this.db
        .prepare("INSERT INTO ai_usage VALUES(?,?,?,?,?,?)")
        .run(id, month, amount, null, "reserved", new Date().toISOString());
      this.db.exec("COMMIT");
      return id;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  settleAi(id: string, actual: number | null) {
    this.db
      .prepare("UPDATE ai_usage SET actual=?,state=? WHERE id=?")
      .run(actual, actual === null ? "uncertain" : "settled", id);
  }
  aiSpent() {
    return Number(
      this.db
        .prepare(
          "SELECT coalesce(sum(coalesce(actual,reserved)),0) spent FROM ai_usage WHERE month=?",
        )
        .get(new Date().toISOString().slice(0, 7))!.spent,
    );
  }
  addContact(leadId:string, contact:{kind:"email"|"phone";value:string;sourceUrl:string;status?:string;e164?:string;phoneType?:string}) {
    const value=contact.kind==="email"?contact.value.trim().toLowerCase():contact.value.trim();
    this.db.prepare("INSERT INTO public_contacts VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(lead_id,kind,value) DO UPDATE SET source_url=CASE WHEN excluded.source_url!='' THEN excluded.source_url ELSE public_contacts.source_url END,found_at=excluded.found_at,status=CASE WHEN excluded.status='publicly_listed' THEN excluded.status ELSE public_contacts.status END,e164=CASE WHEN excluded.e164!='' THEN excluded.e164 ELSE public_contacts.e164 END").run(randomUUID(),leadId,contact.kind,value,contact.sourceUrl,new Date().toISOString(),contact.status||"publicly_listed",contact.e164||"",contact.phoneType||"unknown");
  }
  contacts(leadId:string):PublicContact[] {return this.db.prepare("SELECT id,lead_id AS leadId,kind,value,source_url AS sourceUrl,found_at AS foundAt,status,e164,phone_type AS phoneType FROM public_contacts WHERE lead_id=? ORDER BY kind,value").all(leadId) as unknown as PublicContact[];}
  enrichLead(leadId:string, patch:{website?:string;emails:{value:string;sourceUrl:string}[];phones:{value:string;sourceUrl:string;e164?:string}[];notes:string;sourceUrl:string}) {
    const lead=this.getLead(leadId,"live"); if(!lead)throw new Error("Live lead not found.");
    const data={...lead,website:patch.website||lead.website,email:lead.email||patch.emails[0]?.value||"",phone:lead.phone||patch.phones[0]?.value||""};
    delete data.contacts;
    const evidence=[...lead.evidence,{sourceName:"Public business website research",sourceUrl:patch.sourceUrl,observedAt:new Date().toISOString(),detail:patch.notes}].slice(-40);
    this.db.exec("BEGIN IMMEDIATE");
    try{
      for(const email of patch.emails)this.addContact(leadId,{kind:"email",...email});
      for(const phone of patch.phones)this.addContact(leadId,{kind:"phone",...phone});
      this.db.prepare("UPDATE leads SET data=?,score=?,evidence=?,updated_at=? WHERE id=?").run(JSON.stringify({...data,score:scoreLead(data)}),scoreLead(data),JSON.stringify(evidence),new Date().toISOString(),leadId);
      this.db.exec("COMMIT");return this.getLead(leadId,"live")!;
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  cacheGet<T>(key:string):T|null {const row=this.db.prepare("SELECT data FROM app_cache WHERE cache_key=? AND expires_at>?").get(key,new Date().toISOString());return row?JSON.parse(row.data as string):null;}
  cacheSet(key:string,data:unknown,ttlSeconds=86400) {this.db.prepare("INSERT INTO app_cache VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at").run(key,JSON.stringify(data),new Date(Date.now()+ttlSeconds*1000).toISOString());}
  acquireLock(key:string,milliseconds:number) {
    const now=Date.now();
    return this.db.prepare("INSERT INTO app_locks VALUES(?,?) ON CONFLICT(lock_key) DO UPDATE SET expires_at=excluded.expires_at WHERE app_locks.expires_at<=?").run(key,now+milliseconds,now).changes>0;
  }
  queueJob(kind:string,payload:Record<string,unknown>) {const id=randomUUID(),now=new Date().toISOString();this.db.prepare("INSERT INTO work_jobs VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,kind,"queued",JSON.stringify(payload),0,0,"Waiting for collection worker",null,now,now);return id;}
  claimJob():WorkJob|null {
    this.db.exec("BEGIN IMMEDIATE");try{
      this.db.prepare("UPDATE work_jobs SET status='interrupted',message='Worker stopped. Completed records remain; re-run explicitly to continue.',updated_at=? WHERE status='running' AND updated_at<?").run(new Date().toISOString(),new Date(Date.now()-180000).toISOString());
      if(this.db.prepare("SELECT 1 FROM work_jobs WHERE status='running' LIMIT 1").get()){this.db.exec("COMMIT");return null;}
      const row=this.db.prepare("SELECT * FROM work_jobs WHERE status='queued' ORDER BY created_at LIMIT 1").get();
      if(!row){this.db.exec("COMMIT");return null;}
      this.db.prepare("UPDATE work_jobs SET status='running',updated_at=? WHERE id=? AND status='queued'").run(new Date().toISOString(),row.id as string);
      this.db.exec("COMMIT");return this.job(row.id as string);
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  job(id:string):WorkJob|null {const row=this.db.prepare("SELECT * FROM work_jobs WHERE id=?").get(id);return row?{...row,payload:JSON.parse(row.payload as string),result:row.result?JSON.parse(row.result as string):null,createdAt:row.created_at,updatedAt:row.updated_at} as unknown as WorkJob:null;}
  jobs():WorkJob[] {return this.db.prepare("SELECT id FROM work_jobs ORDER BY created_at DESC LIMIT 30").all().map(row=>this.job(row.id as string)!);}
  updateJob(id:string,patch:{status?:string;progress?:number;total?:number;message?:string;result?:unknown}) {const current=this.job(id);if(!current)return;this.db.prepare("UPDATE work_jobs SET status=?,progress=?,total=?,message=?,result=?,updated_at=? WHERE id=?").run(patch.status||current.status,patch.progress??current.progress,patch.total??current.total,patch.message??current.message,JSON.stringify(patch.result??current.result),new Date().toISOString(),id);}
  isSuppressed(email:string) {return Boolean(this.db.prepare("SELECT 1 FROM suppressions WHERE email=?").get(email.trim().toLowerCase()));}
  suppress(email:string,reason:string) {this.db.prepare("INSERT INTO suppressions VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET reason=excluded.reason").run(email.trim().toLowerCase(),reason,new Date().toISOString());}
  reviewContact(leadId:string,email:string,note:string) {this.db.prepare("INSERT INTO contact_reviews VALUES(?,?,?,?,?) ON CONFLICT(lead_id,email) DO UPDATE SET note=excluded.note,reviewed_at=excluded.reviewed_at,expires_at=excluded.expires_at").run(leadId,email.toLowerCase(),note,new Date().toISOString(),new Date(Date.now()+7*86400000).toISOString());}
  hasContactReview(leadId:string,email:string) {return Boolean(this.db.prepare("SELECT 1 FROM contact_reviews WHERE lead_id=? AND email=? AND expires_at>?").get(leadId,email.toLowerCase(),new Date().toISOString()));}
  messages():OutboundMessage[] {return this.db.prepare("SELECT id,lead_id AS leadId,recipient,subject,body,status,provider_id AS providerId,error,created_at AS createdAt,sent_at AS sentAt FROM outbound_messages ORDER BY created_at DESC LIMIT 200").all() as unknown as OutboundMessage[];}
  reserveMessage(input:{id:string;leadId:string;recipient:string;subject:string;body:string},dailyLimit:number) {
    this.db.exec("BEGIN IMMEDIATE");try{
      const existing=this.db.prepare("SELECT * FROM outbound_messages WHERE id=?").get(input.id);
      if(existing){this.db.exec("COMMIT");return {created:false,status:String(existing.status)};}
      const hash=createHash("sha256").update(JSON.stringify([input.recipient.toLowerCase(),input.subject,input.body])).digest("hex");
      if(this.isSuppressed(input.recipient))throw new Error("Recipient is on your do-not-contact list.");
      if(this.db.prepare("SELECT 1 FROM outbound_messages WHERE content_hash=? AND status IN ('dispatching','accepted','uncertain') AND created_at>?").get(hash,new Date(Date.now()-86400000).toISOString()))throw new Error("This message was already submitted or has uncertain delivery. Check send history before retrying.");
      const count=Number(this.db.prepare("SELECT count(*) n FROM outbound_messages WHERE created_at>=? AND status IN ('dispatching','accepted','uncertain')").get(new Date().toISOString().slice(0,10))!.n);
      if(count>=dailyLimit)throw new Error("Daily sending limit reached.");
      this.db.prepare("INSERT INTO outbound_messages(id,lead_id,recipient,subject,body,content_hash,status,created_at) VALUES(?,?,?,?,?,?,?,?)").run(input.id,input.leadId,input.recipient.toLowerCase(),input.subject,input.body,hash,"dispatching",new Date().toISOString());
      this.db.exec("COMMIT");return {created:true,status:"dispatching"};
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  finishMessage(id:string,status:string,providerId="",error="") {this.db.prepare("UPDATE outbound_messages SET status=?,provider_id=?,error=?,sent_at=? WHERE id=?").run(status,providerId,error,status==="accepted"?new Date().toISOString():null,id);}
  takeQuota(key:string,maximum:number) {const result=this.db.prepare("INSERT INTO usage_counters VALUES(?,1) ON CONFLICT(counter_key) DO UPDATE SET amount=amount+1 WHERE usage_counters.amount<?").run(key,maximum);if(!result.changes)throw new Error("This provider's configured request quota has been reached.");}
}
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
const globalDb = globalThis as unknown as { dataSoftRepository?: Repository };
export function repository() {
  return (globalDb.dataSoftRepository ??= new Repository(
    process.env.DATA_SOFT_DB_PATH || ".data/data-soft.sqlite",
  ));
}
