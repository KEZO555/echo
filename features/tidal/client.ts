// Low-level authed request helper for the TIDAL OpenAPI v2 (JSON:API).
//
// Endpoint helpers in endpoints.ts build on this. It stays decoupled from the
// auth context: callers pass an access token. Auto-refresh-on-401 is wired at
// the context layer so this remains a thin, testable transport.

import {
  DEFAULT_COUNTRY_CODE,
  TIDAL_API_BASE,
  TIDAL_JSON_API_MEDIA_TYPE,
} from "@/constants/tidal";

export type TidalQuery = Record<
  string,
  string | number | boolean | string[] | undefined
>;

export interface TidalRequestOptions {
  accessToken: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  // Sent as countryCode unless the path already provides one via `query`.
  countryCode?: string;
  query?: TidalQuery;
  body?: unknown;
  signal?: AbortSignal;
}

export class TidalApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly body?: unknown;

  constructor(
    status: number,
    message: string,
    options?: { retryAfterSeconds?: number; body?: unknown }
  ) {
    super(message);
    this.name = "TidalApiError";
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.body = options?.body;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

const appendQueryValue = (
  params: URLSearchParams,
  key: string,
  value: string | number | boolean
): void => {
  params.append(key, String(value));
};

const buildUrl = (path: string, query: TidalQuery): string => {
  const base = path.startsWith("http")
    ? path
    : `${TIDAL_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const [pathname, existingQuery] = base.split("?");
  const params = new URLSearchParams(existingQuery ?? "");
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        appendQueryValue(params, key, entry);
      }
    } else {
      appendQueryValue(params, key, value);
    }
  }
  const serialised = params.toString();
  return serialised ? `${pathname}?${serialised}` : pathname;
};

const parseRetryAfter = (header: string | null): number | undefined => {
  if (!header) {
    return undefined;
  }
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
};

// Performs a single authed JSON:API request and returns the parsed document.
// Throws TidalApiError on non-2xx responses (callers inspect `.status`).
export const tidalRequest = async <TResponse>(
  path: string,
  options: TidalRequestOptions
): Promise<TResponse> => {
  const { accessToken, method = "GET", body, signal } = options;
  const query: TidalQuery = { ...options.query };
  if (query.countryCode === undefined) {
    query.countryCode = options.countryCode ?? DEFAULT_COUNTRY_CODE;
  }

  const headers: Record<string, string> = {
    Accept: TIDAL_JSON_API_MEDIA_TYPE,
    Authorization: `Bearer ${accessToken}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = TIDAL_JSON_API_MEDIA_TYPE;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new TidalApiError(
      response.status,
      `TIDAL request failed (${response.status}) for ${path}`,
      {
        retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
        body: parsed,
      }
    );
  }

  return parsed as TResponse;
};
