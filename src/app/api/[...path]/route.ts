import { z } from "zod";
import { repository } from "@/lib/db";
import { leadInputSchema, workspaceOf, type Filters } from "@/lib/domain";
import { analyze, aiConfig } from "@/lib/ai";
import { CSV_TEMPLATE, exportLeadsCsv, parseCsv } from "@/lib/collection";
import { apiError, guardLocal, readJson } from "@/lib/http";
import { collectionSchema, enrichmentSchema } from "@/lib/jobs";
import {
  publicMailConfig,
  sendReviewedEmail,
  verifyMailConnection,
} from "@/lib/mail";
import { validateRemoteUrl } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
function json(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request, context: Context) {
  try {
    guardLocal(request);
    const { path } = await context.params,
      url = new URL(request.url),
      workspace = workspaceOf(url.searchParams.get("workspace"));
    const repo = repository();
    if (path[0] === "leads" && path[1]) {
      const lead = repo.getLead(path[1], workspace);
      return lead
        ? json(lead)
        : Response.json({ error: "Lead not found" }, { status: 404 });
    }
    if (path[0] === "leads")
      return json(
        repo.list(workspace, Object.fromEntries(url.searchParams) as Filters),
      );
    if (path[0] === "sources") return json({ sources: repo.sources() });
    if (path[0] === "runs") return json({ runs: repo.runs() });
    if (path[0] === "jobs")
      return json(
        path[1]
          ? { job: repo.job(path[1]) }
          : { jobs: repo.jobs(), worker: repo.cacheGet("worker-heartbeat") },
      );
    if (path[0] === "mail")
      return json({ config: publicMailConfig(), messages: repo.messages() });
    if (path[0] === "settings") {
      const config = aiConfig();
      return json({
        ai: {
          ready: config.ready,
          model: config.model,
          monthlyCap: config.cap,
          spent: repo.aiSpent(),
        },
        database: "SQLite · local persistent storage",
        version: "0.2.0",
        localOnly: true,
        mail: publicMailConfig(),
        search: {
          ready: Boolean(
            process.env.BRAVE_SEARCH_API_KEY &&
            process.env.SEARCH_STORAGE_RIGHTS_CONFIRMED === "true",
          ),
        },
        worker: repo.cacheGet("worker-heartbeat"),
      });
    }
    if (path[0] === "template")
      return new Response(CSV_TEMPLATE, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            "attachment; filename=data-soft-import-template.csv",
        },
      });
    if (path[0] === "export") {
      const result = repo.list(
        workspace,
        Object.fromEntries(url.searchParams) as Filters,
        true,
      );
      return new Response("\uFEFF" + exportLeadsCsv(result.leads), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=data-soft-${workspace}-leads.csv`,
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    guardLocal(request, true);
    const { path } = await context.params,
      body = await readJson(request),
      repo = repository();
    if (path[0] === "leads") {
      const lead = leadInputSchema.parse(body);
      const result = repo.upsertMany([lead], "live");
      return json({ ...result, workspace: "live" });
    }
    if (path[0] === "import") {
      const input = z
        .object({
          csv: z.string().min(1).max(1_500_000),
          sourceName: z.string().min(2).max(160),
          sourceUrl: z.string().max(2048).default(""),
          permissionConfirmed: z.literal(true),
        })
        .parse(body);
      const leads = parseCsv(input.csv, input.sourceName, input.sourceUrl);
      const result = repo.upsertMany(leads, "live");
      repo.incrementSource("csv", result.imported);
      repo.recordRun({
        source: input.sourceName,
        state: "Multiple",
        city: "",
        status: "completed",
        imported: result.imported,
        updated: result.updated,
        message:
          "CSV import complete. Contact verification and outreach permissions remain separate.",
      });
      return json({ ...result, workspace: "live" });
    }
    if (path[0] === "collect") {
      const input = collectionSchema.parse(body);
      if (
        repo.jobs().filter((job) => ["queued", "running"].includes(job.status))
          .length >= 10
      )
        throw new Error(
          "Ten collection/research jobs are already queued. Let them finish first.",
        );
      const id = repo.queueJob("collect", input);
      return json({
        jobId: id,
        workspace: "live",
        message:
          "Collection queued. Watch progress in Collect leads; completed businesses appear in the live workspace.",
      });
    }
    if (path[0] === "enrich") {
      const input = enrichmentSchema.parse(body);
      if (input.leadIds.some((id) => !repo.getLead(id, "live")))
        throw new Error("Only existing live leads can be researched.");
      if (
        repo.jobs().filter((job) => ["queued", "running"].includes(job.status))
          .length >= 10
      )
        throw new Error("Wait for queued research jobs to finish.");
      return json({
        jobId: repo.queueJob("enrich", {
          leadIds: [...new Set(input.leadIds)],
        }),
        message: "Website and public-contact research queued.",
      });
    }
    if (path[0] === "mail-send") return json(await sendReviewedEmail(body));
    if (path[0] === "mail-verify") return json(await verifyMailConnection());
    if (path[0] === "suppress") {
      const input = z
        .object({
          email: z.email(),
          reason: z.string().trim().min(3).max(1000),
        })
        .parse(body);
      repo.suppress(input.email, input.reason);
      return json({
        ok: true,
        message: "Email added to the do-not-contact list across all leads.",
      });
    }
    if (path[0] === "export") {
      const input = z
        .object({
          workspace: z.enum(["demo", "live"]),
          filters: z.record(z.string(), z.string()).default({}),
          ids: z.array(z.string().uuid()).max(10000).optional(),
        })
        .parse(body);
      const rows = repo.list(
        input.workspace,
        {
          ...input.filters,
          ...(input.ids?.length ? { ids: input.ids.join(",") } : {}),
        },
        true,
      ).leads;
      return new Response("\uFEFF" + exportLeadsCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=data-soft-${input.workspace}-leads.csv`,
        },
      });
    }
    if (path[0] === "analyze") {
      const input = z
        .object({
          leadId: z.string().uuid(),
          workspace: z.enum(["demo", "live"]),
          mode: z.enum(["local", "cloud"]).default("local"),
        })
        .parse(body);
      const lead = repo.getLead(input.leadId, input.workspace);
      if (!lead)
        return Response.json({ error: "Lead not found" }, { status: 404 });
      return json(await analyze(lead, input.mode));
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    guardLocal(request, true);
    const { path } = await context.params;
    if (path[0] !== "leads" || !path[1])
      return Response.json({ error: "Not found" }, { status: 404 });
    const input = z
      .object({
        workspace: z.enum(["demo", "live"]),
        status: z
          .enum(["new", "reviewing", "qualified", "not_a_fit"])
          .optional(),
        confirmedBudget: z
          .number()
          .min(0)
          .max(10_000_000)
          .nullable()
          .optional(),
        confirmedBudgetNote: z.string().max(1000).optional(),
        website: z.union([z.literal(""), z.url()]).optional(),
      })
      .parse(await readJson(request));
    if (input.website !== undefined) {
      if (input.workspace !== "live")
        throw new Error("Only live business website research can be edited.");
      if (input.website) validateRemoteUrl(input.website);
      repository().enrichLead(path[1], {
        website: input.website,
        emails: [],
        phones: [],
        notes:
          "Business website manually entered by the workspace owner; verify identity before outreach.",
        sourceUrl: input.website,
      });
    }
    const lead = repository().updateLead(path[1], input.workspace, input);
    return lead
      ? json(lead)
      : Response.json({ error: "Lead not found" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
