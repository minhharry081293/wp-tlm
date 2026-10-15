"use client";

import { useCallback, useEffect, useState } from "react";
import { IconInbox } from "./icons";
import { Alert, Badge, Card, EmptyState, PageHeader } from "./ui";

type Job = {
  id: string;
  type: string;
  status: string;
  summary: { success?: number; failed?: number; total?: number } | null;
  createdAt: string;
  completedAt: string | null;
  _count?: { items: number };
  items?: {
    id: string;
    status: string;
    error: string | null;
    site: { name: string; baseUrl: string };
  }[];
};

const JOB_STATUS_TONE: Record<string, "success" | "neutral" | "danger" | "warning" | "info"> = {
  completed: "success",
  pending: "neutral",
  running: "info",
  failed: "danger",
  partial: "warning",
};

const JOB_TYPE_LABEL: Record<string, string> = {
  place_csv: "Đặt CSV",
  remove: "Gỡ link",
  health_check: "Health check",
};

export function JobsPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs?limit=30");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function openJob(id: string) {
    const res = await fetch(`/api/jobs?id=${id}`);
    const data = await res.json();
    setSelected(data.job);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" description="Lịch sử health / place CSV / remove." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/80 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className={`cursor-pointer transition hover:bg-stone-50/70 ${
                    selected?.id === job.id ? "bg-teal-50/60" : ""
                  }`}
                  onClick={() => openJob(job.id)}
                >
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {JOB_TYPE_LABEL[job.type] ?? job.type}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={JOB_STATUS_TONE[job.status] ?? "neutral"}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyState
                      icon={<IconInbox className="h-9 w-9" />}
                      title="Chưa có job."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          {!selected ? (
            <p className="text-sm text-stone-500">Chọn job để xem chi tiết.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-stone-400">{selected.id}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-semibold text-stone-900">
                    {JOB_TYPE_LABEL[selected.type] ?? selected.type}
                  </span>
                  <Badge tone={JOB_STATUS_TONE[selected.status] ?? "neutral"}>
                    {selected.status}
                  </Badge>
                </div>
                {selected.summary && (
                  <div className="mt-2 flex gap-4 text-sm text-stone-600">
                    <span className="text-emerald-700">
                      ✓ {selected.summary.success ?? 0} success
                    </span>
                    <span className="text-rose-600">
                      ✕ {selected.summary.failed ?? 0} failed
                    </span>
                    <span className="text-stone-400">
                      / {selected.summary.total ?? selected.items?.length ?? 0} total
                    </span>
                  </div>
                )}
              </div>
              <ul className="max-h-96 space-y-2 overflow-y-auto">
                {selected.items?.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-stone-100 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-stone-800">
                        {item.site.name}
                      </span>
                      <Badge
                        tone={
                          item.status === "success"
                            ? "success"
                            : item.status === "failed"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-stone-400">{item.site.baseUrl}</div>
                    {item.error && (
                      <div className="mt-1 text-xs text-rose-600">{item.error}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
