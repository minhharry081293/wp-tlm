import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@tlm/db";
import { parseCsvLinks } from "@tlm/shared";
import { enqueueTlmJob } from "@/lib/queue";
import { audit } from "@/lib/audit";
import { getSession, siteFilter } from "@/lib/auth";

const MAX_SITES = 50;
const MAX_ROWS = 300;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contentType = req.headers.get("content-type") || "";

  let siteIds: string[] = [];
  let csvText = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const sitesRaw = form.get("siteIds");
    if (typeof sitesRaw === "string") {
      try {
        siteIds = JSON.parse(sitesRaw);
      } catch {
        siteIds = sitesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    const file = form.get("file");
    if (file && typeof file !== "string") {
      csvText = await file.text();
    } else if (typeof form.get("csv") === "string") {
      csvText = String(form.get("csv"));
    }
  } else {
    const body = await req.json();
    siteIds = Array.isArray(body.siteIds) ? body.siteIds.map(String) : [];
    csvText = String(body.csv || "");
  }

  if (!Array.isArray(siteIds) || siteIds.length === 0) {
    return NextResponse.json({ error: "Select at least one site" }, { status: 400 });
  }
  if (siteIds.length > MAX_SITES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_SITES} sites per place job` },
      { status: 400 }
    );
  }
  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV content required" }, { status: 400 });
  }

  let rows;
  try {
    rows = parseCsvLinks(csvText, MAX_ROWS);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid CSV" },
      { status: 400 }
    );
  }

  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds }, ...siteFilter(session) },
    select: { id: true },
  });
  if (sites.length !== siteIds.length) {
    return NextResponse.json({ error: "One or more sites not found" }, { status: 400 });
  }

  const csvHash = createHash("sha256").update(csvText).digest("hex").slice(0, 16);
  const items = rows.map((r) => ({
    target_url: r.targetUrl,
    anchor_text: r.anchorText,
  }));

  const job = await prisma.job.create({
    data: {
      type: "place_csv",
      status: "pending",
      userId: session.uid,
      payload: JSON.stringify({
        siteIds,
        rowCount: rows.length,
        csvHash,
        items,
      }),
      items: {
        create: sites.map((s) => ({
          siteId: s.id,
          status: "pending",
        })),
      },
    },
  });

  await enqueueTlmJob(job.id);
  await audit("job.place_csv", {
    jobId: job.id,
    siteCount: sites.length,
    rowCount: rows.length,
    csvHash,
  });

  return NextResponse.json(
    { jobId: job.id, rowCount: rows.length, siteCount: sites.length },
    { status: 201 }
  );
}
