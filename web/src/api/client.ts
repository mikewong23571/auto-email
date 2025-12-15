export const API_BASE = "/api"; // Proxy will handle this or full URL
const TOKEN_KEY = "mail_cleaner_token";

// Simple token management for now
export const setToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token);
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

export const apiClient = async (path: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Default to JSON
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    // headers.set('Content-Type', 'application/json');
    // Only if body is present? Fetch handles it often.
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
    }
    throw new Error(`API Error: ${res.statusText}`);
  }

  // Handle 204?
  if (res.status === 204) return null;

  return res.json();
};
