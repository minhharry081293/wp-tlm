"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconSearch, IconTrash } from "./icons";
import { Alert, Button, Card, EmptyState, PageHeader } from "./ui";

type SiteMatch = {
  id: string;
  name: string;
  baseUrl: string;
  status: string;
  anchors: string[];
  error?: string;
};

type PlacedLink = {
  targetUrl: string;
  anchors: string[];
  sites: SiteMatch[];
};

export function RemovePanel() {
  const [links, setLinks] = useState<PlacedLink[]>([]);
  const [query, setQuery] = useState("");
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async (live = false) => {
    const res = await fetch(live ? "/api/links?live=1" : "/api/links");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không tải được danh sách link");
    setLinks(data.links || []);
    setSource(live ? "live" : "index");
    const failed = (data.siteErrors || []) as { name: string; error: string }[];
    if (failed.length > 0) {
      setError(
        failed.map((s) => `${s.name}: ${s.error}`).join(" · ")
      );
    }
  }, []);

  useEffect(() => {
    setBusy(true);
    load(true)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (link) =>
        link.targetUrl.toLowerCase().includes(q) ||
        link.anchors.some((a) => a.toLowerCase().includes(q)) ||
        link.sites.some(
          (s) =>
            s.name.toLowerCase().includes(q) || s.baseUrl.toLowerCase().includes(q)
        )
    );
  }, [links, query]);

  const active = links.find((link) => link.targetUrl === activeUrl) || null;

  function choose(link: PlacedLink) {
    setActiveUrl(link.targetUrl);
    setSelected(new Set(link.sites.map((s) => s.id)));
    setError(null);
    setResult(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function liveScan() {
    if (!activeUrl) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const qs = new URLSearchParams({ url: activeUrl, live: "1" });
      const res = await fetch(`/api/links/lookup?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Live scan failed");
      const fresh = (data.matches || []) as {
        site: { id: string };
        anchors: string[];
      }[];
      await load();
      setSelected(new Set(fresh.filter((m) => m.anchors.length > 0).map((m) => m.site.id)));
      setSource("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!active) return;
    if (selected.size === 0) {
      setError("Chọn ít nhất 1 PBN để gỡ");
      return;
    }
    if (!confirm(`Gỡ link ${active.targetUrl} trên ${selected.size} PBN?`)) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/jobs/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: active.targetUrl,
          siteIds: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      const job = await pollJob(data.jobId);
      setResult(
        `Job ${data.jobId} — ${job?.status || "done"}. Thành công: ${job?.summary?.success ?? "?"}, lỗi: ${job?.summary?.failed ?? "?"}`
      );
      await load();
      setActiveUrl(null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gỡ text hàng loạt"
        description="Xem text link đã đặt, bấm một dòng để thấy PBN đang gắn, rồi chọn site và gỡ."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {result && <Alert tone="success">{result}</Alert>}

      <Card className="flex flex-wrap items-center gap-2 p-4">
        <div className="relative min-w-[280px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lọc theo chữ neo, URL đích hoặc site"
            className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm placeholder:text-stone-400 focus:border-teal-600 focus:outline-none"
          />
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setError(null);
            setBusy(true);
            load(true)
              .catch((err) => setError(err instanceof Error ? err.message : String(err)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Đang đọc PBN…" : "Làm mới từ PBN"}
        </Button>
        <span className="text-xs text-stone-500">
          {filtered.length} link
          {source === "live" ? " · đã đọc từ PBN" : ""}
        </span>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50/80 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-3 font-medium">Chữ neo</th>
              <th className="px-5 py-3 font-medium">URL đích</th>
              <th className="px-5 py-3 font-medium">PBN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <EmptyState
                    icon={<IconSearch className="h-9 w-9" />}
                    title={
                      busy
                        ? "Đang đọc link trên PBN…"
                        : links.length === 0
                          ? "Chưa có text link đã đặt"
                          : "Không khớp bộ lọc"
                    }
                    description={
                      busy
                        ? "Danh sách chữ neo, URL đích và site sẽ hiện ở đây."
                        : links.length === 0
                          ? "Link xuất hiện ở đây sau khi đặt thành công."
                          : "Thử chữ neo, URL hoặc tên site khác."
                    }
                  />
                </td>
              </tr>
            ) : (
              filtered.map((link) => {
                const on = link.targetUrl === activeUrl;
                return (
                  <tr
                    key={link.targetUrl}
                    onClick={() => choose(link)}
                    className={`cursor-pointer transition ${on ? "bg-teal-50/80" : "hover:bg-stone-50/70"}`}
                  >
                    <td className="px-5 py-3.5 font-medium text-stone-900">
                      {link.anchors.join(", ") || "—"}
                    </td>
                    <td className="max-w-xs truncate px-5 py-3.5 text-stone-600">
                      {link.targetUrl}
                    </td>
                    <td className="px-5 py-3.5 text-stone-700">
                      {link.sites.map((s) => s.name).join(", ")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {active && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                {active.anchors.join(", ") || active.targetUrl}
              </h3>
              <p className="mt-1 break-all text-xs text-stone-500">{active.targetUrl}</p>
            </div>
            <Button variant="secondary" disabled={busy} onClick={liveScan}>
              Live scan PBN
            </Button>
          </div>
          <div className="divide-y divide-stone-100 rounded-lg border border-stone-100">
            {active.sites.map((site) => (
              <label
                key={site.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-stone-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(site.id)}
                  onChange={() => toggle(site.id)}
                  className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
                />
                <span className="text-sm font-medium text-stone-800">{site.name}</span>
                <span className="truncate text-xs text-stone-400">{site.baseUrl}</span>
                {site.anchors.length > 0 && (
                  <span className="ml-auto text-xs text-stone-500">
                    {site.anchors.join(", ")}
                  </span>
                )}
                {site.error && (
                  <span className="text-xs text-rose-600">{site.error}</span>
                )}
              </label>
            ))}
          </div>
          <Button
            variant="danger"
            disabled={busy || selected.size === 0}
            onClick={removeSelected}
          >
            <IconTrash className="h-4 w-4" />
            {busy ? "Đang gỡ…" : `Gỡ trên ${selected.size} PBN`}
          </Button>
        </Card>
      )}
    </div>
  );
}

async function pollJob(jobId: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/jobs?id=${jobId}`);
    const data = await res.json();
    const status = data.job?.status;
    if (status === "completed" || status === "failed" || status === "partial") {
      return data.job as {
        status: string;
        summary?: { success?: number; failed?: number };
      };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
