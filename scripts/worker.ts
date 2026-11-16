import { repository } from "../src/lib/db";
import { processJob } from "../src/lib/jobs";

const repo = repository();
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
console.log(
  "DataSoft collection worker ready. Public discovery and website research only; no email jobs.",
);
while (!stopping) {
  repo.cacheSet(
    "worker-heartbeat",
    { at: new Date().toISOString(), pid: process.pid },
    20,
  );
  const job = repo.claimJob();
  if (!job) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    continue;
  }
  const heartbeat = setInterval(() => {
    repo.updateJob(job.id, {});
    repo.cacheSet(
      "worker-heartbeat",
      { at: new Date().toISOString(), pid: process.pid },
      20,
    );
  }, 10000);
  try {
    await processJob(job, repo);
  } catch (error) {
    repo.updateJob(job.id, {
      status: "failed",
      message:
        error instanceof Error ? error.message : "Collection worker failed.",
    });
    console.error(
      "Collection failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    clearInterval(heartbeat);
  }
}
repo.close();
