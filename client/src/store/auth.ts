import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, CUSTOMER_TOKEN_KEY } from '@/lib/api';

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar?: string | null;
  role: string;
  loyaltyPoints: number;
}

interface AuthState {
  user: Customer | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: { name: string; email?: string; phone?: string; password: string }) => Promise<void>;
  logout: () => void;
  setSession: (token: string, user: Customer) => void;
  setUser: (user: Customer) => void;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      async login(identifier, password) {
        const res = await api.post('/auth/login', { identifier, password });
        const token = res.data.token || res.data.data?.token;
        const user = res.data.user || res.data.data?.user;

        if (!token) {
          throw new Error('সার্ভার থেকে কোনো টোকেন পাওয়া যায়নি।');
        }

        localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
        set({ token, user });
      },
      async register(payload) {
        const res = await api.post('/auth/register', payload);
        const token = res.data.token || res.data.data?.token;
        const user = res.data.user || res.data.data?.user;

        if (!token) {
          throw new Error('সার্ভার থেকে কোনো টোকেন পাওয়া যায়নি।');
        }

        localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
        set({ token, user });
      },
      setSession(token, user) {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
        set({ token, user });
      },
      logout() {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        set({ token: null, user: null });
      },
      setUser(user) {
        set({ user });
      },
      async refresh() {
        try {
          const res = await api.get('/auth/profile');
          const user = res.data.user || res.data.data?.user;
          set({ user });
        } catch {
          localStorage.removeItem(CUSTOMER_TOKEN_KEY);
          set({ token: null, user: null });
        }
      },
    }),
    { name: 'nijer_bazaar_auth' } // api.ts এর storageKeyForReset এর সাথে নিখুঁতভাবে মেলানো হলো
  )
);

// Clear both persisted and in-memory customer auth state when the API rejects
// an expired or invalid JWT; this lets protected routes return to sign-in.
if (typeof window !== 'undefined') {
  window.addEventListener('nb:customer-unauthorized', () => useAuth.getState().logout());
}

export const isLoggedIn = () => Boolean(useAuth.getState().token && useAuth.getState().user);