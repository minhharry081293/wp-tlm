import { config } from "dotenv";
import { resolve } from "node:path";
import { prisma } from "@tlm/db";
import { processJob } from "@tlm/jobs";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const POLL_MS = 2000;

console.log("[tlm-worker] polling SQLite for pending jobs (no Redis)");

async function tick() {
  const pending = await prisma.job.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true },
  });

  for (const job of pending) {
    try {
      console.log(`[tlm-worker] processing ${job.id}`);
      await processJob(job.id);
      console.log(`[tlm-worker] done ${job.id}`);
    } catch (err) {
      console.error(
        `[tlm-worker] failed ${job.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function loop() {
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error("[tlm-worker] tick error:", err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

void loop();
