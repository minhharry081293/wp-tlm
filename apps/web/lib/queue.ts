import { processJob } from "@tlm/jobs";

/**
 * Fire-and-forget job runner — no Redis required.
 * Runs in the Next.js process (local / single-node).
 */
export async function enqueueTlmJob(jobId: string): Promise<void> {
  void processJob(jobId).catch((err) => {
    console.error(`[tlm] job ${jobId} failed:`, err);
  });
}
