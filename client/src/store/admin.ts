import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminApi, ADMIN_TOKEN_KEY } from '@/lib/api';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  avatar?: string | null;
}

interface AdminState {
  admin: AdminUser | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  validateSession: () => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
}

export const useAdmin = create<AdminState>()(
  persist(
    (set, get) => ({
      admin: null,
      token: null,
      async login(identifier, password) {
        const res = await adminApi.post('/auth/admin/login', { identifier, password });
        
        // ব্যাকএন্ডের রেসপন্স ফরম্যাট অনুযায়ী টোকেন ও অ্যাডমিন ডেটা নিশ্চিত করা
        const token = res.data.token || res.data.data?.token;
        const admin = res.data.admin || res.data.user || res.data.data?.admin || res.data.data?.data?.user;

        if (!token) {
          throw new Error('সার্ভার থেকে কোনো টোকেন পাওয়া যায়নি।');
        }

        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        set({ token, admin });
      },
      async validateSession() {
        await adminApi.get('/auth/admin/me');
      },
      logout() {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        set({ token: null, admin: null });
      },
      can(permission) {
        const admin = get().admin;
        if (!admin) return false;
        if (admin.role === 'super_admin') return true;
        return admin.permissions?.includes(permission) ?? false;
      },
    }),
    { name: 'nijer_bazaar_admin_auth' } // api.ts এর সাথে নিখুঁতভাবে মেলানো হলো
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('nb:admin-unauthorized', () => useAdmin.getState().logout());
}