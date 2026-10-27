import axios, { AxiosError, AxiosRequestConfig } from 'axios';

// যদি VITE_API_ORIGIN সেট করা না থাকে, তবে লোকাল সার্ভার পোর্ট ৫০০০ ব্যবহার করবে
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined) ?? 'http://localhost:5000';
const BASE = `${API_ORIGIN}/api`;

// স্টোরের লোকাল স্টোরেজ কি (Key)-এর সাথে সামঞ্জস্যপূর্ণ করা হলো
export const CUSTOMER_TOKEN_KEY = 'nijer_bazaar_customer_token';
export const ADMIN_TOKEN_KEY = 'nijer_bazaar_admin_token';

/** Absolute URL for media returned by the API (e.g. /uploads/products/x.png). */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getApiErrorMessage(error: unknown, fallback = 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।'): string {
  const err = error as AxiosError<{ message?: string; error?: string }>;
  const data = err?.response?.data;
  return data?.message || data?.error || err?.message || fallback;
}

function createClient(tokenKey: string, storageKeyForReset: string) {
  const instance = axios.create({ baseURL: BASE, timeout: 30000, headers: { 'Content-Type': 'application/json' } });
  
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem(tokenKey);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(storageKeyForReset);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(tokenKey === ADMIN_TOKEN_KEY ? 'nb:admin-unauthorized' : 'nb:customer-unauthorized'));
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

/** Storefront client. */
export const api = createClient(CUSTOMER_TOKEN_KEY, 'nijer_bazaar_auth');

/** Admin / staff client (separate token, separate reset behaviour). */
export const adminApi = createClient(ADMIN_TOKEN_KEY, 'nijer_bazaar_admin_auth');

/** Uploads are multipart, so build the config explicitly. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await adminApi.post(`/uploads/${folder}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  } as AxiosRequestConfig);
  return res.data.urls?.[0] ?? res.data.url;
}

export default api;