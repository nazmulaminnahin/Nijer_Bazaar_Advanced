import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { useSettings } from '@/store/settings';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { Button, Card, Input, Textarea } from '@/components/ui';

export default function ContactPage() {
  const settings = useSettings((s) => s.settings);
  const user = useAuth((s) => s.user);
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', email: user?.email ?? '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact', form);
      setSent(true);
      toast.success('বার্তা পাঠানো হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-page py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink-900">যোগাযোগ করুন</h1>
        <p className="mt-1 text-sm text-gray-500">প্রশ্ন, অভিযোগ বা পরামর্শ — আমরা শুনতে চাই</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-5">
          {sent ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-3 text-lg font-semibold text-ink-900">ধন্যবাদ!</p>
              <p className="mt-1 text-sm text-gray-500">আপনার বার্তা আমরা পেয়েছি। গ্রাহকসেবা দল শীঘ্রই যোগাযোগ করবে।</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSent(false); setForm({ name: '', phone: '', email: '', subject: '', message: '' }); }}>আরেকটি বার্তা</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <Input label="নাম" requiredMark value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="মোবাইল নম্বর" requiredMark value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" />
              <Input label="ইমেইল" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Input label="বিষয়" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
              <div className="sm:col-span-2">
                <Textarea label="বার্তা" requiredMark rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" icon={Send} loading={loading}>বার্তা পাঠান</Button>
              </div>
            </form>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">সরাসরি যোগাযোগ</h2>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span>{settings.contact_phone}</span></li>
              <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span className="break-all">{settings.contact_email}</span></li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span>{settings.contact_address}</span></li>
              <li className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span>{settings.support_hours}</span></li>
            </ul>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-900">সচরাচর জিজ্ঞাসা</h2>
            <div className="space-y-2 text-xs text-gray-600">
              <p><span className="font-medium text-ink-900">ডেলিভারি কত দিনে?</span><br />ঢাকার ভিতরে ২৪–৪৮ ঘণ্টা, বাইরে ২–৫ কার্যদিবস।</p>
              <p><span className="font-medium text-ink-900">ক্যাশ অন ডেলিভারি আছে?</span><br />হ্যাঁ, পণ্য হাতে পেয়ে টাকা পরিশোধ করতে পারবেন।</p>
              <p><span className="font-medium text-ink-900">পণ্য বদলানো যাবে?</span><br />পণ্যে ত্রুটি থাকলে ডেলিভারির ২৪ ঘণ্টার মধ্যে জানাতে হবে।</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
