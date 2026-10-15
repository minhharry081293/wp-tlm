"use client";

import { useCallback, useEffect, useState } from "react";
import { IconGlobe } from "./icons";
import { Alert, Button, Card, PageHeader } from "./ui";

type Site = {
  id: string;
  name: string;
  baseUrl: string;
  status: string;
};

type LinkRow = { url: string; text: string };

export function PlacePanel() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<LinkRow[]>([{ url: "", text: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    jobId: string;
    rowCount: number;
    siteCount: number;
    job?: unknown;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sites");
    const data = await res.json();
    setSites(data.sites || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= 50) {
          setError("Tối đa 50 PBN mỗi lần đặt");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function updateRow(index: number, field: keyof LinkRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function toggleAll() {
    if (selected.size === Math.min(sites.length, 50)) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sites.slice(0, 50).map((s) => s.id)));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (selected.size === 0) {
      setError("Chọn ít nhất 1 PBN");
      return;
    }
    const filled = rows.filter((r) => r.url.trim() || r.text.trim());
    if (filled.length === 0) {
      setError("Điền URL đích và chữ neo");
      return;
    }
    if (filled.length > 300) {
      setError("Tối đa 300 dòng mỗi lần đặt");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("siteIds", JSON.stringify(Array.from(selected)));
      form.set("csv", toCsv(filled));
      const res = await fetch("/api/jobs/place", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Place job failed");
      const job = await pollJob(data.jobId);
      setResult({ ...data, job });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đặt text hàng loạt"
        description="Chọn tối đa 50 PBN, điền URL đích và chữ neo (tối đa 300 dòng)."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {result && (
        <Alert tone="success">
          Job <code className="rounded bg-white/60 px-1 py-0.5">{result.jobId}</code> —{" "}
          {result.rowCount} dòng × {result.siteCount} site. Status:{" "}
          <strong>
            {(result.job as { status?: string } | undefined)?.status || "queued"}
          </strong>
          . Xem chi tiết tại{" "}
          <a href="/jobs" className="underline">
            Jobs
          </a>
          .
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-6">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900">
              Chọn PBN ({selected.size}/50)
            </h3>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              {selected.size === Math.min(sites.length, 50)
                ? "Bỏ chọn"
                : "Chọn tối đa 50"}
            </button>
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-stone-100">
            {sites.map((site) => (
              <label
                key={site.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-stone-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(site.id)}
                  onChange={() => toggle(site.id)}
                  className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
                />
                <span className="text-sm font-medium text-stone-800">{site.name}</span>
                <span className="truncate text-xs text-stone-400">{site.baseUrl}</span>
              </label>
            ))}
            {sites.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-stone-400">
                <IconGlobe className="mx-auto mb-2 h-6 w-6 text-stone-300" />
                Chưa có site.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900">
              Link ({rows.filter((r) => r.url.trim() || r.text.trim()).length}/300)
            </h3>
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { url: "", text: "" }])}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              Thêm dòng
            </button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-xs font-medium text-stone-500">
            <span>URL đích</span>
            <span>Chữ neo</span>
            <span className="w-8" />
          </div>
          <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  value={row.url}
                  onChange={(e) => updateRow(index, "url", e.target.value)}
                  placeholder="https://example.com/page"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-400 focus:border-teal-600 focus:outline-none"
                />
                <input
                  value={row.text}
                  onChange={(e) => updateRow(index, "text", e.target.value)}
                  placeholder="chữ neo"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-400 focus:border-teal-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) =>
                      prev.length === 1 ? [{ url: "", text: "" }] : prev.filter((_, i) => i !== index)
                    )
                  }
                  className="w-8 text-sm text-stone-400 hover:text-rose-600"
                  aria-label="Xóa dòng"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Đang chạy…" : "Đặt textlink"}
        </Button>
      </form>
    </div>
  );
}

function csvCell(value: string) {
  const v = value.trim();
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function toCsv(rows: LinkRow[]) {
  return ["anchor,text", ...rows.map((r) => `${csvCell(r.url)},${csvCell(r.text)}`)].join("\n");
}

async function pollJob(jobId: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/jobs?id=${jobId}`);
    const data = await res.json();
    const status = data.job?.status;
    if (status === "completed" || status === "failed" || status === "partial") {
      return data.job;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
