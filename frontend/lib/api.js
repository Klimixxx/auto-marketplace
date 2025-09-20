// frontend/lib/api.js
const API = process.env.NEXT_PUBLIC_API_BASE || '';

export function getToken() {
  try {
    const t = localStorage.getItem('token');
    return t && t.trim() ? t : null;
  } catch { return null; }
}

export async function apiFetch(path, { method='GET', body, headers } = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': body ? 'application/json' : undefined,
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}
