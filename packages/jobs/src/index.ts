import { prisma } from "@tlm/db";
import {
  batchUpsertLinks,
  checkSiteHealth,
  deleteLinksByUrl,
} from "@tlm/shared";

const CONCURRENCY = 5;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

async function finishItem(
  itemId: string,
  status: string,
  result?: unknown,
  error?: string
) {
  await prisma.jobItem.update({
    where: { id: itemId },
    data: {
      status,
      result: result === undefined ? undefined : JSON.stringify(result),
      error: error ?? null,
      completedAt: new Date(),
    },
  });
}

export async function processJob(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      items: {
        include: { site: true },
      },
    },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (
    job.status === "running" ||
    job.status === "completed" ||
    job.status === "partial"
  ) {
    return;
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    const payload = parseJson<Record<string, unknown>>(job.payload, {});

    if (job.type === "health_check") {
      await runHealth(job.items);
    } else if (job.type === "place_csv") {
      await runPlace(job.items, payload as unknown as PlacePayload);
    } else if (job.type === "remove") {
      await runRemove(job.items, payload as unknown as RemovePayload);
    }

    const items = await prisma.jobItem.findMany({ where: { jobId } });
    const failed = items.filter((i) => i.status === "failed").length;
    const success = items.filter((i) => i.status === "success").length;
    const status =
      failed === 0 ? "completed" : success === 0 ? "failed" : "partial";

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: new Date(),
        summary: JSON.stringify({ success, failed, total: items.length }),
      },
    });
  } catch (err) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        summary: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
      },
    });
    throw err;
  }
}

async function runHealth(
  items: {
    id: string;
    site: { id: string; baseUrl: string };
  }[]
) {
  await mapPool(items, CONCURRENCY, async (item) => {
    await prisma.jobItem.update({
      where: { id: item.id },
      data: { status: "running", startedAt: new Date() },
    });
    try {
      const result = await checkSiteHealth(item.site.baseUrl);
      await prisma.site.update({
        where: { id: item.site.id },
        data: {
          status: result.status,
          lastCheckedAt: new Date(),
          lastError: result.error,
          linkCount: result.linkCount ?? undefined,
        },
      });
      await finishItem(item.id, "success", result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.site.update({
        where: { id: item.site.id },
        data: {
          status: "timeout",
          lastCheckedAt: new Date(),
          lastError: msg,
        },
      });
      await finishItem(item.id, "failed", undefined, msg);
    }
  });
}

type PlacePayload = {
  items: { target_url: string; anchor_text: string }[];
};

async function runPlace(
  items: { id: string; site: { id: string; baseUrl: string } }[],
  payload: PlacePayload
) {
  const linkItems = payload.items || [];
  await mapPool(items, CONCURRENCY, async (item) => {
    await prisma.jobItem.update({
      where: { id: item.id },
      data: { status: "running", startedAt: new Date() },
    });
    try {
      const result = await batchUpsertLinks(item.site.baseUrl, linkItems);

      for (const link of linkItems) {
        await prisma.linkIndex.upsert({
          where: {
            siteId_targetUrl_anchorText: {
              siteId: item.site.id,
              targetUrl: link.target_url,
              anchorText: link.anchor_text,
            },
          },
          create: {
            siteId: item.site.id,
            targetUrl: link.target_url,
            anchorText: link.anchor_text,
          },
          update: {},
        });
      }

      await prisma.site.update({
        where: { id: item.site.id },
        data: {
          linkCount: result.total,
          status: "ok",
          lastError: null,
          lastCheckedAt: new Date(),
        },
      });

      await finishItem(item.id, "success", result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await finishItem(item.id, "failed", undefined, msg);
    }
  });
}

type RemovePayload = { targetUrl: string };

async function runRemove(
  items: { id: string; site: { id: string; baseUrl: string } }[],
  payload: RemovePayload
) {
  const targetUrl = payload.targetUrl;
  await mapPool(items, CONCURRENCY, async (item) => {
    await prisma.jobItem.update({
      where: { id: item.id },
      data: { status: "running", startedAt: new Date() },
    });
    try {
      const result = await deleteLinksByUrl(item.site.baseUrl, targetUrl);

      await prisma.$executeRaw`
        UPDATE "LinkIndex"
        SET "remoteId" = NULL
        WHERE "siteId" = ${item.site.id} AND typeof("remoteId") = 'text'
      `;
      await prisma.linkIndex.deleteMany({
        where: { siteId: item.site.id, targetUrl },
      });

      await prisma.site.update({
        where: { id: item.site.id },
        data: {
          linkCount: result.total,
          lastCheckedAt: new Date(),
        },
      });

      await finishItem(item.id, "success", result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await finishItem(item.id, "failed", undefined, msg);
    }
  });
}
