"use client";

import { useCallback, useEffect, useState } from "react";
import { IconGlobe, IconRefresh, IconTrash } from "./icons";
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from "./ui";

type Site = {
  id: string;
  name: string;
  baseUrl: string;
  status: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  linkCount: number;
};

const STATUS_TONE: Record<string, "success" | "neutral" | "danger" | "warning" | "info"> = {
  ok: "success",
  unknown: "neutral",
  http_error: "danger",
  timeout: "warning",
  plugin_missing: "warning",
  unauthorized: "info",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  unknown: "Chưa kiểm tra",
  http_error: "HTTP lỗi",
  timeout: "Timeout",
  plugin_missing: "Thiếu plugin",
  unauthorized: "Unauthorized",
};

export function SitesPanel() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [urlsText, setUrlsText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sites");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSites(data.sites);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addSites(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlsText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      const created = data.created ?? data.sites?.length ?? 0;
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
      setInfo(`Đã thêm ${created} site` + (skipped ? `, bỏ qua ${skipped} (đã có)` : ""));
      setUrlsText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeSite(id: string) {
    if (!confirm("Xóa site này khỏi dashboard?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkHealth(siteIds?: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteIds ? { siteIds } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Health job failed");
      await pollJob(data.jobId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Cài + Active plugin wp-tlm trên PBN, rồi paste URL vào đây (không cần API key). Check all để kiểm tra HTTP + plugin."
        action={
          <Button
            variant="primary"
            disabled={busy || sites.length === 0}
            onClick={() => checkHealth()}
          >
            <IconRefresh className="h-4 w-4" />
            Check all
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-stone-900">
          Thêm PBN (bulk URL)
        </h3>
        <p className="mb-3 text-xs text-stone-500">
          Mỗi dòng một URL. Tối đa 200. Tên site lấy từ hostname.
        </p>
        <form onSubmit={addSites} className="space-y-3">
          <textarea
            required
            rows={6}
            placeholder={"https://pbn1.com\nhttps://pbn2.com\npbn3.com"}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm placeholder:font-sans placeholder:text-stone-400 focus:border-teal-600 focus:outline-none"
          />
          <Button type="submit" variant="primary" disabled={busy || !urlsText.trim()}>
            Thêm site
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50/80 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-3 font-medium">Site</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Links</th>
              <th className="px-5 py-3 font-medium">Last check</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-stone-400">
                  Đang tải…
                </td>
              </tr>
            ) : sites.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<IconGlobe className="h-9 w-9" />}
                    title="Chưa có site nào"
                    description="Cài plugin WP-TLM lên PBN rồi paste URL vào form phía trên."
                  />
                </td>
              </tr>
            ) : (
              sites.map((site) => (
                <tr key={site.id} className="transition hover:bg-stone-50/70">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-stone-900">{site.name}</div>
                    <a
                      href={site.baseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-teal-700 hover:underline"
                    >
                      {site.baseUrl}
                    </a>
                    {site.lastError && (
                      <div className="mt-1 text-xs text-rose-600">{site.lastError}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={STATUS_TONE[site.status] ?? "neutral"}>
                      {STATUS_LABEL[site.status] ?? site.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-stone-700">
                    {site.linkCount}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-stone-500">
                    {site.lastCheckedAt
                      ? new Date(site.lastCheckedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => checkHealth([site.id])}
                      >
                        <IconRefresh className="h-3.5 w-3.5" />
                        Check
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => removeSite(site.id)}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function pollJob(jobId: string, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/jobs?id=${jobId}`);
    const data = await res.json();
    const status = data.job?.status;
    if (status === "completed" || status === "failed" || status === "partial") {
      return data.job;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
