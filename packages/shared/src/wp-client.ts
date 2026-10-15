export type WpLink = {
  id: number;
  target_url: string;
  anchor_text: string;
  created_at?: string;
  updated_at?: string;
};

export type HealthResult = {
  httpStatus: number | null;
  pluginOk: boolean;
  status:
    | "ok"
    | "http_error"
    | "timeout"
    | "plugin_missing"
    | "unauthorized";
  linkCount: number | null;
  error: string | null;
  version: string | null;
};

export function normalizeBaseUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u.replace(/\/+$/, "");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function wpFetch(
  baseUrl: string,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const url = `${normalizeBaseUrl(baseUrl)}/wp-json/tlm/v1${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetchWithTimeout(url, { ...init, headers });
}

export async function checkSiteHealth(baseUrl: string): Promise<HealthResult> {
  const root = normalizeBaseUrl(baseUrl);
  let httpStatus: number | null = null;

  try {
    const pageRes = await fetchWithTimeout(root + "/", {
      method: "GET",
      redirect: "follow",
      timeoutMs: 12000,
    });
    httpStatus = pageRes.status;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("AbortError")) {
      return {
        httpStatus: null,
        pluginOk: false,
        status: "timeout",
        linkCount: null,
        error: "Site HTTP probe timed out",
        version: null,
      };
    }
    return {
      httpStatus: null,
      pluginOk: false,
      status: "timeout",
      linkCount: null,
      error: `Site unreachable: ${msg}`,
      version: null,
    };
  }

  if (httpStatus !== null && httpStatus >= 400) {
    return {
      httpStatus,
      pluginOk: false,
      status: "http_error",
      linkCount: null,
      error: `HTTP ${httpStatus}`,
      version: null,
    };
  }

  try {
    const res = await wpFetch(root, "/health", { timeoutMs: 12000 });
    if (res.status === 404) {
      return {
        httpStatus,
        pluginOk: false,
        status: "plugin_missing",
        linkCount: null,
        error: "Plugin REST endpoint not found",
        version: null,
      };
    }
    if (!res.ok) {
      return {
        httpStatus,
        pluginOk: false,
        status: "plugin_missing",
        linkCount: null,
        error: `Health endpoint HTTP ${res.status}`,
        version: null,
      };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      link_count?: number;
      version?: string;
    };
    return {
      httpStatus,
      pluginOk: true,
      status: "ok",
      linkCount: data.link_count ?? 0,
      error: null,
      version: data.version ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("AbortError")) {
      return {
        httpStatus,
        pluginOk: false,
        status: "timeout",
        linkCount: null,
        error: "Plugin health check timed out",
        version: null,
      };
    }
    return {
      httpStatus,
      pluginOk: false,
      status: "plugin_missing",
      linkCount: null,
      error: msg,
      version: null,
    };
  }
}

export async function batchUpsertLinks(
  baseUrl: string,
  items: { target_url: string; anchor_text: string }[]
) {
  const res = await wpFetch(baseUrl, "/links/batch", {
    method: "POST",
    body: JSON.stringify({ items }),
    timeoutMs: 60000,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : `Batch upsert failed: HTTP ${res.status}`
    );
  }
  return data as {
    inserted: number;
    updated: number;
    errors: unknown[];
    total: number;
  };
}

export async function deleteLinksByUrl(baseUrl: string, targetUrl: string) {
  const res = await wpFetch(baseUrl, "/links", {
    method: "DELETE",
    body: JSON.stringify({ target_url: targetUrl }),
    timeoutMs: 30000,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : `Delete failed: HTTP ${res.status}`
    );
  }
  return data as { deleted: number; total: number };
}

function normalizeLinks(data: { links?: WpLink[] } | null): WpLink[] {
  if (!data?.links) return [];
  return data.links.map((link) => {
    const id = Number(link.id);
    return {
      ...link,
      id: Number.isInteger(id) ? id : 0,
      target_url: String(link.target_url ?? ""),
      anchor_text: String(link.anchor_text ?? ""),
    };
  });
}

export async function listAllLinks(baseUrl: string): Promise<WpLink[]> {
  const res = await wpFetch(baseUrl, "/links", { timeoutMs: 20000 });
  if (!res.ok) {
    throw new Error(`List links failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { links?: WpLink[] };
  return normalizeLinks(data);
}

export async function listLinksByUrl(
  baseUrl: string,
  targetUrl: string
): Promise<WpLink[]> {
  const qs = new URLSearchParams({ url: targetUrl });
  const res = await wpFetch(baseUrl, `/links?${qs.toString()}`, {
    timeoutMs: 20000,
  });
  if (!res.ok) {
    throw new Error(`List links failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { links?: WpLink[] };
  return normalizeLinks(data);
}
