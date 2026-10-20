// Thin fetch wrapper for the /api/v1 REST API.
// - Same-origin cookies carry the server-side session.
// - Admin and auth mutations send the session CSRF token.

const BASE = '/api/v1';
let csrfToken = null;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function setCsrfToken(token) {
  csrfToken = token ?? null;
}

async function fetchCsrfToken() {
  const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'same-origin' });
  const json = await res.json();
  csrfToken = json.data.csrfToken;
  return csrfToken;
}

const needsCsrf = (path, method) => method !== 'GET' && (path.startsWith('/admin') || path.startsWith('/auth'));

function buildUrl(path, query) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }
  return url.pathname + url.search;
}

/**
 * Perform a request and return the parsed JSON envelope `{ success, data, meta }`.
 * Throws ApiError for non-2xx responses.
 */
export async function request(path, { method = 'GET', query, body, formData, retry = true, keepalive = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (needsCsrf(path, method)) headers['X-CSRF-Token'] = csrfToken ?? (await fetchCsrfToken());
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(buildUrl(path, query), { method, headers, body: payload, credentials: 'same-origin', keepalive });
  if (res.status === 204) return { success: true, data: null };

  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response (e.g. proxy error)
  }

  if (!res.ok || !json?.success) {
    const error = json?.error ?? {};
    if (error.code === 'CSRF_INVALID' && retry) {
      await fetchCsrfToken();
      return request(path, { method, query, body, formData, retry: false });
    }
    throw new ApiError(res.status, error.code ?? 'HTTP_ERROR', error.message ?? `Request failed (${res.status})`, error.details);
  }
  return json;
}

export const api = {
  get: (path, query) => request(path, { query }).then((r) => r.data),
  getPage: (path, query) => request(path, { query }).then((r) => ({ data: r.data, meta: r.meta })),
  post: (path, body) => request(path, { method: 'POST', body }).then((r) => r.data),
  put: (path, body) => request(path, { method: 'PUT', body }).then((r) => r.data),
  patch: (path, body) => request(path, { method: 'PATCH', body }).then((r) => r.data),
  delete: (path) => request(path, { method: 'DELETE' }).then((r) => r.data),
  upload: (path, formData, query) => request(path, { method: 'POST', formData, query }).then((r) => r.data),
};

/** Download a CSV export (keeps the session cookie). */
export function downloadUrl(path, query) {
  return buildUrl(path, query);
}

/** Apply server-side validation details to a react-hook-form instance. Returns true if any were applied. */
export function applyServerErrors(error, setError) {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return false;
  let applied = false;
  for (const detail of error.details) {
    if (detail.path) {
      setError(detail.path, { type: 'server', message: detail.message });
      applied = true;
    }
  }
  return applied;
}

export function errorMessage(error) {
  if (error instanceof ApiError) {
    if (error.details?.length) return `${error.message}: ${error.details.map((d) => d.message).join('; ')}`;
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
