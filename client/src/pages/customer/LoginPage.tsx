import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuth((s) => s.login); // স্টোরের login ফাংশন ব্যবহার করা হলো
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      toast.success('সফলভাবে লগইন হয়েছে');
      navigate(next, { replace: true });
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
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><LogIn className="h-6 w-6" /></span>
            <h1 className="mt-3 text-xl font-bold text-ink-900">লগইন করুন</h1>
            <p className="mt-1 text-sm text-gray-500">ইমেইল বা মোবাইল নম্বর দিয়ে প্রবেশ করুন</p>
          </div>

          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <form onSubmit={submit} className="space-y-3">
            <Input
              label="ইমেইল বা মোবাইল নম্বর"
              requiredMark
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com অথবা 01712345678"
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
            <Button type="submit" className="w-full" size="lg" loading={loading}>লগইন</Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            অ্যাকাউন্ট নেই? <Link to="/register" className="font-medium text-brand-600 hover:underline">রেজিস্ট্রেশন করুন</Link>
          </p>
        </div>

        <Link to="/admin/login" className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-brand-600">
          <ShieldCheck className="h-3.5 w-3.5" /> অ্যাডমিন ও স্টাফ লগইন
        </Link>
      </div>
    </div>
  );
}