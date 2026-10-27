import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { Button, Input } from '@/components/ui';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim() && !form.phone.trim()) { setError('ইমেইল অথবা মোবাইল নম্বর — অন্তত একটি দিন।'); return; }
    if (form.password.length < 8) { setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'); return; }
    if (form.password !== form.confirm) { setError('পাসওয়ার্ড দুটি মিলছে না।'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      setSession(res.data.token, res.data.user);
      toast.success('অ্যাকাউন্ট তৈরি হয়েছে');
      navigate('/', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <div className="mb-5 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><UserPlus className="h-6 w-6" /></span>
            <h1 className="mt-3 text-xl font-bold text-ink-900">নতুন অ্যাকাউন্ট</h1>
            <p className="mt-1 text-sm text-gray-500">ফ্রি রেজিস্ট্রেশন করে কেনাকাটা শুরু করুন</p>
          </div>

          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <form onSubmit={submit} className="space-y-3">
            <Input label="পূর্ণ নাম" requiredMark required minLength={2} value={form.name} onChange={set('name')} placeholder="আপনার নাম" autoComplete="name" />
            <Input label="ইমেইল" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
            <Input label="মোবাইল নম্বর" value={form.phone} onChange={set('phone')} placeholder="01712345678" inputMode="tel" autoComplete="tel" />
            <p className="-mt-1 text-[11px] text-gray-400">ইমেইল অথবা মোবাইল — অন্তত একটি দিতে হবে।</p>
            <div className="relative">
              <Input label="পাসওয়ার্ড" requiredMark type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="কমপক্ষে ৮ অক্ষর" minLength={8} required autoComplete="new-password" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-9 p-1 text-gray-400 hover:text-gray-600" aria-label={show ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input label="পাসওয়ার্ড নিশ্চিত করুন" requiredMark type="password" value={form.confirm} onChange={set('confirm')} placeholder="আবার লিখুন" minLength={8} required autoComplete="new-password" />
            <Button type="submit" className="w-full" size="lg" loading={loading}>রেজিস্ট্রেশন</Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            আগে থেকেই অ্যাকাউন্ট আছে? <Link to="/login" className="font-medium text-brand-600 hover:underline">লগইন করুন</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
