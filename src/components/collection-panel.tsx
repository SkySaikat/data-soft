"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Compass,
  Database,
  Globe,
  Info,
  LoaderCircle,
  Upload,
} from "lucide-react";
import {
  INDUSTRIES,
  STATES,
  type CollectionRun,
  type Source,
  type WorkJob,
} from "@/lib/domain";
import { api, post } from "@/lib/client-api";

export function CollectionPanel({
  sources,
  runs,
  onQueued,
  onChanged,
  onImport,
}: {
  sources: Source[];
  runs: CollectionRun[];
  onQueued: () => void;
  onChanged: () => void;
  onImport: () => void;
}) {
  const [source, setSource] = useState<"osm" | "ny-public" | "nppes" | "directory">("ny-public"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [jobs, setJobs] = useState<WorkJob[]>([]),
    [worker, setWorker] = useState(false),
    [activeId, setActiveId] = useState("");
  const changed = useRef(onChanged);
  changed.current = onChanged;
  useEffect(() => {
    let active = true;
    let previous = "";
    async function poll() {
      try {
        const data = await api<{ jobs: WorkJob[]; worker: unknown }>("jobs");
        if (!active) return;
        setJobs(data.jobs);
        setWorker(Boolean(data.worker));
        const fingerprint = data.jobs
          .map((j) => `${j.id}:${j.status}:${j.progress}`)
          .join("|");
        if (previous && previous !== fingerprint) changed.current();
        previous = fingerprint;
      } catch (error) {
        if (active) setError((error as Error).message);
      }
    }
    void poll();
    const timer = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ jobId: string }>(
        "collect",
        post({
          ...fields,
          source,
          enrich: fields.enrich === "on",
          permissionConfirmed: fields.permissionConfirmed === "on",
        }),
      );
      setActiveId(result.jobId);
      onQueued();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            MORE INDUSTRIES. REAL BUSINESS CONTACTS.
          </div>
          <h1>
            Collect leads<span className="title-dot">.</span>
          </h1>
          <p>
            Find local businesses, discover listed websites, and research their
            public contact pages.
          </p>
        </div>
      </div>
      <div className="collection-layout">
        <section className="panel collection-panel">
          <div className="panel-heading">
            <span className="green-icon">
              <Compass size={21} />
            </span>
            <div>
              <h2>Start a collection</h2>
              <p>New records are saved to your live workspace.</p>
            </div>
          </div>
          <div className="source-choices three-choices">
            {[
              {id:"ny-public",name:"Official NY records",description:"Trades, legal offices & real estate",icon:Database},
              {
                id: "osm",
                name: "Local businesses",
                description: "Trades, legal, property & more",
                icon: Compass,
              },
              {
                id: "nppes",
                name: "Healthcare",
                description: "Public organization registry",
                icon: Building2,
              },
              {
                id: "directory",
                name: "Approved directory",
                description: "Structured business listings",
                icon: Globe,
              },
            ].map((item) => (
              <button
                key={item.id}
                aria-pressed={source === item.id}
                className={source === item.id ? "selected" : ""}
                onClick={() => setSource(item.id as typeof source)}
              >
                <item.icon size={19} />
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="field">
                State
                <select key={source} name="state" defaultValue={source==="ny-public"?"NY":"TX"} required>
                  {STATES.map((s) => (
                    <option key={s.code} value={s.code} disabled={source==="ny-public"&&s.code!=="NY"}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                City
                <input
                  key={source}
                  name="city"
                  defaultValue={source==="ny-public"?"New York":""}
                  required={source === "osm"}
                  placeholder={
                    source === "osm" ? "e.g. Austin" : "Optional city"
                  }
                />
              </label>
              {source === "osm" || source === "ny-public" ? (
                <>
                  <label className="field full">
                    Business industry
                    <select name="industry" defaultValue="all">
                      <option value="all">All local businesses</option>
                      {INDUSTRIES.filter((i) => source==="ny-public"?["Plumbing","Electrical","Legal","Real estate","Home renovation"].includes(i):i!=="Other").map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </select>
                  </label>
                  {source==="osm"?<label className="field">
                    Search radius
                    <select name="radiusKm" defaultValue="10">
                      <option value="5">5 km around city center</option>
                      <option value="10">10 km around city center</option>
                      <option value="20">20 km around city center</option>
                      <option value="30">30 km around city center</option>
                    </select>
                  </label>:<div className="mini-note">New York business/practice records only. Other states use the local-business or approved-directory connector.</div>}
                  <label className="field">
                    Maximum source records
                    <select name="limit" defaultValue="100">
                      <option>50</option>
                      <option>100</option>
                      <option>250</option>
                    </select>
                  </label>
                </>
              ) : source === "nppes" ? (
                <label className="field full">
                  Organization keyword
                  <input name="keyword" placeholder="Optional, e.g. dental" />
                </label>
              ) : (
                <>
                  <label className="field full">
                    Directory page URL
                    <input
                      name="url"
                      required
                      type="url"
                      placeholder="https://approved-directory.com/listings"
                    />
                  </label>
                  <label className="field full">
                    Directory name
                    <input
                      name="sourceName"
                      required
                      minLength={2}
                      placeholder="Publisher name"
                    />
                  </label>
                  <label className="consent full">
                    <input
                      name="permissionConfirmed"
                      type="checkbox"
                      required
                    />
                    <span>
                      This directory permits my intended automated access and
                      reuse.
                    </span>
                  </label>
                </>
              )}
            </div>
            <label className="consent">
              <input type="checkbox" name="enrich" defaultChecked />
              <span>
                <strong>Find websites & public contact details.</strong>{" "}
                Research up to three permitted pages per business. Listed sites and corporate-email domains are checked first; optional search or manual review handles missing sites.
              </span>
            </label>
            <div className="collection-limit">
              <Info size={16} />
              <span>
                {source === "ny-public" ? "Official public datasets cover New York trade businesses, legal offices and real estate businesses. Contacts vary by dataset; public information is not outreach consent. Collection is bounded and partial." : source === "osm"
                  ? "OpenStreetMap coverage varies by industry and location. This is a bounded radius search, not a complete business census. Public API use is limited to 20 manual queries/day by default; use a dedicated instance or licensed source for scale."
                  : source === "nppes"
                    ? "Up to 50 organization records; practice locations are checked against your search."
                    : "Supports JSON-LD LocalBusiness records from one page. Restricted platforms are not scraped."}
              </span>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Compass size={16} />
              )}
              Queue collection
            </button>
          </form>
        </section>
        <aside className="collection-aside">
          <article className="panel">
            <span className="green-icon">
              <Upload size={22} />
            </span>
            <h3>Bring another source</h3>
            <p>
              Import authorized lists of plumbers, electricians, lawyers, real
              estate agents, or any other industry, then select leads for
              website research.
            </p>
            <button className="button secondary" onClick={onImport}>
              Import CSV
              <ArrowRight size={15} />
            </button>
          </article>
          <article className="coverage-card">
            <span className="eyebrow">ORDINARY AUTOMATION. NO AI CREDITS.</span>
            <h3>Public contacts, with evidence.</h3>
            <p>
              Website, contact-page email and business phone extraction run in a
              background worker. Contact emails are never guessed; nothing is messaged automatically.
            </p>
            <div>
              <span className="online-dot" />
              {worker
                ? "Collection worker online"
                : "Worker starting or offline"}
            </div>
          </article>
        </aside>
      </div>
      <section className="panel runs-panel">
        <h2>
          Research queue <span>{jobs.length}</span>
        </h2>
        {jobs.length ? (
          <div className="job-list">
            {jobs.map((job) => (
              <article
                className={`job-card ${activeId === job.id ? "highlight" : ""}`}
                key={job.id}
              >
                <div className="job-title">
                  <strong>
                    {job.kind === "collect"
                      ? `${String(job.payload.industry || "Local businesses")} · ${String(job.payload.city || job.payload.state || "")}`
                      : "Website & contact research"}
                  </strong>
                  <span
                    className={`source-status ${job.status === "failed" ? "red" : ["partial", "interrupted"].includes(job.status) ? "amber" : job.status === "running" ? "blue" : "green"}`}
                  >
                    {job.status}
                  </span>
                </div>
                <p>{job.message}</p>
                {job.total > 0 ? (
                  <>
                    <progress aria-label="Website research progress" max={job.total} value={job.progress} />
                    <small>
                      {job.progress} of {job.total} business websites processed
                    </small>
                  </>
                ) : null}
                {job.result?.failures &&
                Array.isArray(job.result.failures) &&
                job.result.failures.length ? (
                  <details>
                    <summary>
                      See businesses needing attention (
                      {job.result.failures.length})
                    </summary>
                    <ul>
                      {(
                        job.result.failures as {
                          name: string;
                          message: string;
                        }[]
                      ).map((failure, index) => (
                        <li key={index}>
                          <strong>{failure.name}</strong> — {failure.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="small-empty">
            <Database size={22} />
            <p>
              No jobs yet. Queued discoveries and website research will appear
              here.
            </p>
          </div>
        )}
      </section>
      <div className="info-box">
        <Info size={18} />
        <div>
          <strong>Open data attribution</strong>
          <p>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap contributors · ODbL 1.0
            </a>
            . City centers come from the U.S. Census Gazetteer. API throttling,
            caching and source restrictions apply.{" "}
            {sources.filter((s) => s.status === "available").length}{" "}
            collection/research methods available.
          </p>
        </div>
      </div>
      {runs.length ? (
        <section className="panel runs-panel">
          <h2>Discovery history</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Area</th>
                  <th>New / updated</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <strong>{run.source}</strong>
                      <small className="run-message">{run.message}</small>
                    </td>
                    <td>
                      {run.city}, {run.state}
                    </td>
                    <td>
                      {run.imported} / {run.updated}
                    </td>
                    <td>{run.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
