/**
 * Thin fetch wrapper used by every resource module under lib/api/.
 *
 * Goals:
 *  - One place to set base URL, default headers, auth, and error shape.
 *  - Resource modules call request<T>() and get a typed result OR throw ApiError.
 *  - Components never call fetch() directly.
 */

export const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "";

/**
 * Mock mode rules:
 *   - NEXT_PUBLIC_USE_MOCK="true"  → always mock
 *   - NEXT_PUBLIC_USE_MOCK="false" → always real API
 *   - unset → auto: real when API_BASE_URL is configured, mock otherwise
 */
export const USE_MOCK = (() => {
  if (typeof process === "undefined") return true;
  const flag = process.env.NEXT_PUBLIC_USE_MOCK;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !API_BASE_URL;
})();

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

type QueryValue = string | number | boolean | undefined | null;
type QueryParam = QueryValue | QueryValue[];

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, QueryParam>;
  body?: Json | FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Override auth token for this call only. */
  token?: string | null;
}

/**
 * Pluggable auth-token resolver. Default reads NEXT_PUBLIC_API_TOKEN for dev.
 * Replace via setAuthTokenProvider() once a real auth flow exists.
 */
let tokenProvider: () => string | null | undefined = () => {
  if (typeof process === "undefined") return null;
  return process.env.NEXT_PUBLIC_API_TOKEN || null;
};

export function setAuthTokenProvider(fn: () => string | null | undefined) {
  tokenProvider = fn;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null || item === "") continue;
        params.append(k, String(item));
      }
    } else {
      params.append(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  // Empty API_BASE_URL is allowed — requests go same-origin (useful for
  // Next.js API routes or a reverse-proxied backend). Set the env var
  // when the backend lives on a different host.
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };

  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  let body: BodyInit | undefined;
  if (opts.body !== undefined && method !== "GET") {
    if (isFormData) {
      body = opts.body as FormData;
    } else {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  const token = opts.token !== undefined ? opts.token : tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body,
      signal: opts.signal,
      // "same-origin" avoids breaking CORS preflight when the backend
      // doesn't set Access-Control-Allow-Credentials. Switch to "include"
      // if/when cookie auth is needed.
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError((e as Error).message || "Network error", 0, "network_error");
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const errObj = (parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}) as {
      message?: string;
      error?: string;
      code?: string;
    };
    throw new ApiError(
      errObj.message || errObj.error || `Request failed (${res.status})`,
      res.status,
      errObj.code,
      parsed,
    );
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: RequestOptions["body"], opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: RequestOptions["body"], opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: RequestOptions["body"], opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
