// Mirrors client/src/lib/api.ts's conventions, but scoped to the customer portal:
// separate 401 handling (redirects to /album/login, not /login) since customer
// sessions use their own cookie namespace, entirely independent of the admin app.
function handleUnauthorized(url: string, status: number) {
  if (status !== 401) return;
  if (url === '/api/customer/auth/me' || url === '/api/customer/auth/login') return;
  if (window.location.pathname === '/album/login') return;
  window.location.href = '/album/login';
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  handleUnauthorized(url, res.status);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const customerApi = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
};
