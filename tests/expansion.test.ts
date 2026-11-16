import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Repository } from "../src/lib/db";
import { leadInputSchema } from "../src/lib/domain";
import { mapOsm, osmQuery, parsePlaces } from "../src/lib/business-discovery";
import { extractPublicContacts } from "../src/lib/website-research";
import { renderMail, sendReviewedEmail } from "../src/lib/mail";
import { SMTPServer } from "smtp-server";
import nodemailer from "nodemailer";
import type { AddressInfo } from "node:net";

function input(index: number, overrides: Record<string, unknown> = {}) {
  return leadInputSchema.parse({
    name: `Local Business ${index}`,
    industry: "Plumbing",
    city: "Austin",
    state: "TX",
    ...overrides,
  });
}
test("100, custom, 1000 and all page sizes retain filters and pagination", () => {
  const repo = new Repository(":memory:", false);
  repo.upsertMany(
    Array.from({ length: 225 }, (_, i) => input(i)),
    "live",
  );
  assert.equal(repo.list("live").leads.length, 100);
  assert.equal(
    repo.list("live", { pageSize: "100", page: "3" }).leads.length,
    25,
  );
  assert.equal(repo.list("live", { pageSize: "175" }).leads.length, 175);
  assert.equal(repo.list("live", { pageSize: "1000" }).leads.length, 225);
  assert.equal(
    repo.list("live", { pageSize: "all", industry: "Plumbing" }).leads.length,
    225,
  );
  assert.equal(
    repo.list("live", { pageSize: "all", state: "FL" }).leads.length,
    0,
  );
  repo.close();
});
test("selected exports no longer silently truncate after 500 IDs", () => {
  const repo = new Repository(":memory:", false);
  const { ids } = repo.upsertMany(
    Array.from({ length: 750 }, (_, i) => input(i)),
    "live",
  );
  assert.equal(
    repo.list("live", { ids: ids.join(",") }, true).leads.length,
    750,
  );
  repo.close();
});
test("Census place coordinates parse without online place-search services", () => {
  const rows = parsePlaces(
    "USPS\tNAME\tINTPTLAT\tINTPTLONG\nTX\tAustin city\t30.2672\t-97.7431\n",
  );
  assert.deepEqual(rows, [
    { state: "TX", name: "Austin city", lat: 30.2672, lon: -97.7431 },
  ]);
  assert.equal(
    parsePlaces(
      "USPS|GEOID|NAME|INTPTLAT|INTPTLONG\nTX|4805000|Austin city|30.2672|-97.7431",
    )[0].name,
    "Austin city",
  );
  assert.throws(() => parsePlaces("unexpected\tcolumns\n1\t2"));
});
test("OSM maps plumbers, electricians, lawyers and real estate without budget gates", () => {
  const tags: Record<string, string>[] = [
    { name: "Plumber", craft: "plumber", website: "https://plumber.example" },
    { name: "Electrician", craft: "electrician" },
    { name: "Law Office", office: "lawyer" },
    { name: "Realty", office: "estate_agent" },
  ];
  const result = mapOsm(
    tags.map((tag, i) => ({ type: "node", id: i + 1, tags: tag })),
    "TX",
    "Austin",
    "all",
  );
  assert.equal(result.length, 4);
  assert.deepEqual(
    result.map((r) => r.industry),
    ["Plumbing", "Electrical", "Legal", "Real estate"],
  );
  assert.ok(result.every((r) => r.budget === "unknown"));
  assert.equal(result[0].website, "https://plumber.example/");
  const query = osmQuery(
    { state: "TX", name: "Austin", lat: 30, lon: -97 },
    "Legal",
    10,
    100,
  );
  assert.match(query, /office.*lawyer/);
  assert.match(query, /around:10000,30,-97/);
  assert.match(query, /out tags center 100/);
});
test("website extraction records published contacts and contact-page provenance", () => {
  const html = `<html><body><a href="mailto:hello@actual-business.com?subject=Inquiry">Email</a><p>For sales: sales@actual-business.com. Phone: (512) 555-1234</p><a href="tel:+12125551234">Call</a><a href="/contact">Contact us</a><script>const x='hidden@bad-domain.com';</script><span hidden>private@bad-domain.com</span><a href="https://elsewhere.com/contact">Other site</a></body></html>`;
  const result = extractPublicContacts(html, "https://actual-business.com/");
  assert.deepEqual(result.emails.map((e) => e.value).sort(), [
    "hello@actual-business.com",
    "sales@actual-business.com",
  ]);
  assert.equal(result.phones.length, 2);
  assert.ok(result.phones.every((p) => p.e164.startsWith("+1")));
  assert.deepEqual(result.links, ["https://actual-business.com/contact"]);
});
test("contact enrichment preserves both old identity and new public source evidence", () => {
  const repo = new Repository(":memory:", false);
  const { ids } = repo.upsertMany([input(1)], "live");
  const result = repo.enrichLead(ids[0], {
    website: "https://business.example",
    emails: [
      {
        value: "contact@business.example",
        sourceUrl: "https://business.example/contact",
      },
    ],
    phones: [
      {
        value: "+1 212 555 1234",
        e164: "+12125551234",
        sourceUrl: "https://business.example/contact",
      },
    ],
    notes: "Found on public contact page",
    sourceUrl: "https://business.example/contact",
  });
  assert.equal(result.contacts?.length, 2);
  assert.equal(result.name, "Local Business 1");
  assert.equal(result.evidence.length, 2);
  assert.equal(repo.list("live").leads[0].contacts?.length, 2);
  repo.close();
});
test("collection jobs are durable records and only one worker claims active collection", () => {
  const repo = new Repository(":memory:", false);
  const first = repo.queueJob("enrich", { leadIds: [] });
  repo.queueJob("enrich", { leadIds: [] });
  assert.equal(repo.claimJob()?.id, first);
  assert.equal(repo.claimJob(), null);
  repo.updateJob(first, { status: "completed", progress: 1, total: 1 });
  assert.ok(repo.claimJob());
  repo.close();
});
test("source quotas fail closed for invalid or exhausted limits", () => {
  const repo = new Repository(":memory:", false);
  assert.throws(() => repo.takeQuota("disabled", 0));
  repo.takeQuota("daily", 1);
  assert.throws(() => repo.takeQuota("daily", 1), /quota/);
  repo.close();
});
test("email footer includes real sender details and rejects leftover templates", () => {
  const config = {
    agency: "Example Agency",
    postalAddress: "1 Business Street",
    replyTo: "reply@agency.test",
  };
  const message = renderMail("A reviewed business introduction.", config);
  assert.match(message, /Business advertisement/);
  assert.match(message, /1 Business Street/);
  assert.match(message, /unsubscribe/);
  assert.throws(
    () => renderMail("Hi from [your name]", config),
    /placeholders/,
  );
});
const config = {
  ready: true,
  missing: [],
  from: "sender@agency.test",
  replyTo: "replies@agency.test",
  agency: "Test Agency",
  postalAddress: "1 Test Street",
  dailyLimit: 20,
};
function sendFixture(repo: Repository) {
  const { ids } = repo.upsertMany(
    [input(1, { email: "office@business.test" })],
    "live",
  );
  return {
    id: randomUUID(),
    leadId: ids[0],
    recipient: "office@business.test",
    subject: "A useful business idea",
    body: "Hello, this is a reviewed and relevant business introduction.",
    reviewed: true as const,
    reviewNote:
      "Public contact and relevance checked using a synthetic test fixture.",
  };
}
test("suppression blocks a reviewed email across duplicate business records", async () => {
  const repo = new Repository(":memory:", false),
    input = sendFixture(repo);
  let calls = 0;
  repo.suppress(input.recipient, "Opt-out received");
  await assert.rejects(
    () =>
      sendReviewedEmail(input, {
        repo,
        config,
        sender: {
          sendMail: async () => {
            calls++;
            return { accepted: [input.recipient] };
          },
        },
        domainCheck: async () => true,
      }),
    /opted out/,
  );
  assert.equal(calls, 0);
  repo.close();
});
test("SMTP ambiguous submission is recorded and cannot be blindly retried", async () => {
  const repo = new Repository(":memory:", false),
    input = sendFixture(repo);
  let calls = 0;
  const dependencies = {
    repo,
    config,
    sender: {
      sendMail: async () => {
        calls++;
        throw new Error("Connection dropped after DATA");
      },
    },
    domainCheck: async () => true,
  };
  assert.equal(
    (await sendReviewedEmail(input, dependencies)).status,
    "uncertain",
  );
  assert.equal((await sendReviewedEmail(input, dependencies)).duplicate, true);
  await assert.rejects(
    () =>
      sendReviewedEmail(
        { ...input, id: randomUUID(), body: input.body + " A second attempt." },
        dependencies,
      ),
    /uncertain/,
  );
  assert.equal(calls, 1);
  repo.close();
});
test("real SMTP integration submits once to a local test server, never a prospect", async () => {
  const received: string[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => {
        received.push(Buffer.concat(chunks).toString("utf8"));
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.server.address() as AddressInfo).port;
  const transport = nodemailer.createTransport({
    host: "127.0.0.1",
    port,
    secure: false,
    ignoreTLS: true,
  });
  const repo = new Repository(":memory:", false),
    input = sendFixture(repo);
  try {
    const sender = {
      sendMail: async (message: Record<string, unknown>) => {
        const result = await transport.sendMail(message);
        return { accepted: result.accepted, messageId: result.messageId };
      },
    };
    const dependencies = {
      repo,
      config,
      sender,
      domainCheck: async () => true,
    };
    const result = await sendReviewedEmail(input, dependencies);
    assert.equal(result.status, "accepted");
    assert.equal(
      (await sendReviewedEmail(input, dependencies)).duplicate,
      true,
    );
    assert.equal(received.length, 1);
    assert.match(received[0], /office@business.test/);
    assert.match(received[0], /Business advertisement/);
    assert.equal(repo.messages()[0].status, "accepted");
  } finally {
    transport.close();
    repo.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
