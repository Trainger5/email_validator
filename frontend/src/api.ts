const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

type FetchOptions = {
  path: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: any;
};

const jsonHeaders = { "Content-Type": "application/json" };

async function apiRequest<T>(opts: FetchOptions): Promise<T> {
  const url = `${API_BASE}${opts.path.startsWith("/") ? "" : "/"}${opts.path}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: { ...opts.headers },
    body: opts.body,
  });
  const data = await res.json();
  return data as T;
}

export type ValidationResult = {
  ok: boolean;
  email: string;
  status: string;
  reason?: string | null;
  bounce_likely?: boolean | null;
  bounce_reason?: string | null;
  is_deliverable?: boolean | null;
  is_disposable?: boolean | null;
  is_catch_all?: boolean | null;
  domain_has_mx?: boolean | null;
  smtp_connectable?: boolean | null;
  mx_hosts?: string[];
  record_id?: number;
  input?: Record<string, any>;
};

export type BulkResponse = {
  results: ValidationResult[];
  summary: Record<string, number>;
  total: number;
  error?: string;
};

export type AuthInfo = { token: string; username: string; role: string };
export type AdminStats = {
  total: number;
  deliverable: number;
  undeliverable: number;
  invalid: number;
  bounce_likely: number;
  recent: { email: string; validation_status: string; validation_reason?: string; created_at?: string }[];
};

export async function validateSingle(email: string): Promise<ValidationResult & { error?: string }> {
  return apiRequest({
    path: `/validate?email=${encodeURIComponent(email)}`,
  });
}

export async function validateBulk(emails: string[]): Promise<BulkResponse> {
  return apiRequest({
    path: "/validate/bulk",
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ emails }),
  });
}

export async function uploadFile(file: File, concurrency: number): Promise<BulkResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("concurrency", String(concurrency));
  return apiRequest({
    path: "/validate/upload",
    method: "POST",
    body: form,
  });
}

export async function fetchAdminValidations(token?: string): Promise<{ total: number; data: any[]; error?: string }> {
  return apiRequest({
    path: "/admin/validations",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function fetchAdminStats(token?: string): Promise<AdminStats & { error?: string }> {
  return apiRequest({
    path: "/admin/stats",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function templateUrl(kind: "csv" | "excel") {
  return `${API_BASE}/template/${kind}`;
}

export function exportUrl(token?: string) {
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${API_BASE}/admin/export${suffix}`;
}

export async function login(username: string, password: string): Promise<AuthInfo & { error?: string }> {
  return apiRequest({
    path: "/auth/login",
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
}

export async function me(token: string): Promise<{ username: string; role: string; error?: string }> {
  return apiRequest({
    path: "/auth/me",
    headers: { Authorization: `Bearer ${token}` },
  });
}
