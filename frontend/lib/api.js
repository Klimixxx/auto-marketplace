// frontend/lib/api.js
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

export function resolveApiUrl(path = '') {
  if (typeof path !== 'string') return '';
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE) return suffix;
  return `${API_BASE}${suffix}`;
}

export function getToken() {
  try {
    const t = localStorage.getItem('token');
    return t && t.trim() ? t : null;
  } catch { return null; }
}

export async function apiFetch(path, { method='GET', body, headers } = {}) {
  const token = getToken();
  const url = resolveApiUrl(path);
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}
