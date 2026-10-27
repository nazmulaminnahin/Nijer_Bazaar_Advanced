import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAdmin } from '@/store/admin';
import { getApiErrorMessage } from '@/lib/api';
import { Button, Input } from '@/components/ui';

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, token, admin, validateSession, logout } = useAdmin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/admin/dashboard';

  useEffect(() => {
    if (!token || !admin) return;
    let active = true;
    void validateSession()
      .then(() => { if (active) navigate(next, { replace: true }); })
      .catch(() => { if (active) logout(); });
    return () => { active = false; };
  }, [token, admin, next, navigate, validateSession, logout]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center text-white">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <LayoutDashboard className="h-7 w-7 text-brand-300" />
          </span>
          <h1 className="mt-3 text-xl font-bold">Admin &amp; Staff Login</h1>
          <p className="mt-1 text-xs text-white/60">নিজের বাজার — ব্যবস্থাপনা প্যানেল</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <Input
              label="ইমেইল বা মোবাইল নম্বর"
              requiredMark
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@example.com অথবা 017XXXXXXXX"
              autoComplete="username"
              autoFocus
            />
            <div className="relative">
              <Input
                label="পাসওয়ার্ড"
                requiredMark
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-9 p-1 text-gray-400 hover:text-gray-600" aria-label={show ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>লগইন করুন</Button>
          </form>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" /> শুধুমাত্র অনুমোদিত অ্যাডমিন ও স্টাফদের জন্য
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-white/50">
          <a href="/" className="hover:text-white">← ওয়েবসাইটে ফিরুন</a>
        </p>
      </div>
    </div>
  );
}
