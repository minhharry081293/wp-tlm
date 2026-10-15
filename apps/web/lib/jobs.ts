import { prisma } from "@tlm/db";
import { enqueueTlmJob } from "@/lib/queue";

export async function createHealthCheckJob(siteIds: string[], userId?: string) {
  const job = await prisma.job.create({
    data: {
      type: "health_check",
      status: "pending",
      userId: userId || null,
      payload: JSON.stringify({ siteIds }),
      items: {
        create: siteIds.map((siteId) => ({ siteId, status: "pending" })),
      },
    },
  });
  await enqueueTlmJob(job.id);
  return job;
}
