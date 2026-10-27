import { useEffect, useMemo, useState } from 'react';
import { Save, Upload, RotateCcw, Truck, Palette, Bell, CreditCard, Layout, Info, Plug } from 'lucide-react';
import { adminApi, getApiErrorMessage, mediaUrl } from '@/lib/api';
import { useAdmin } from '@/store/admin';
import { useSettings } from '@/store/settings';
import { toast } from '@/lib/toast';
import { Button, Card, Input, SmartImage, Switch, Textarea, Input as Field, PageSpinner, ErrorState } from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';
import { cn } from '@/lib/utils';

interface Definition {
  key: string; label: string; labelBn?: string | null; type: string; group: string;
  value: string; min: number | null; max: number | null; public: boolean;
}

const GROUP_META: Record<string, { label: string; icon: React.ElementType; hint: string }> = {
  branding: { label: 'ব্র্যান্ডিং', icon: Palette, hint: 'লোগো, সাইটের নাম ও রঙ' },
  general: { label: 'সাধারণ', icon: Info, hint: 'সাধারণ কনফিগারেশন' },
  header: { label: 'হেডার ও টপবার', icon: Layout, hint: 'উপরের বার ও যোগাযোগ তথ্য' },
  footer: { label: 'ফুটার ও যোগাযোগ', icon: Info, hint: 'ফুটার টেক্সট, সোশ্যাল লিংক, ঠিকানা' },
  shipping: { label: 'ডেলিভারি ও ফ্রি শিপিং', icon: Truck, hint: 'ঢাকার ভিতরে/বাইরে চার্জ ও ফ্রি ডেলিভারির নিয়ম' },
  payment: { label: 'পেমেন্ট', icon: CreditCard, hint: 'ক্যাশ অন ডেলিভারি, বিকাশ, নগদ' },
  notifications: { label: 'নোটিফিকেশন', icon: Bell, hint: 'চ্যানেল চালু/বন্ধ (প্রোভাইডার আলাদা পেজে)' },
  integration: { label: 'ইন্টিগ্রেশন', icon: Plug, hint: 'তৃতীয় পক্ষের সেবা' },
};

export default function SettingsPage() {
  const can = useAdmin((s) => s.can);
  const refreshPublic = useSettings((s) => s.load);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [groups, setGroups] = useState<Record<string, Definition[]>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState('shipping');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.get('/admin/settings');
      const groupsRaw: Record<string, Definition[]> = res.data.groups ?? {};
      const flat: Definition[] = Object.values(groupsRaw).flat();
      setGroups(groupsRaw);
      setDefinitions(flat);
      const map: Record<string, string> = {};
      flat.forEach((d) => { map[d.key] = String(d.value ?? ''); });
      setValues(map);
      setOriginal(map);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const dirtyKeys = useMemo(
    () => Object.keys(values).filter((k) => values[k] !== original[k]),
    [values, original]
  );

  const save = async () => {
    if (!dirtyKeys.length) { toast.info('কোনো পরিবর্তন নেই'); return; }
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      dirtyKeys.forEach((k) => { payload[k] = values[k]; });
      const res = await adminApi.put('/admin/settings', payload);
      const saved = res.data.settings ?? {};
      const map = { ...values };
      Object.keys(payload).forEach((k) => { if (saved[k] != null) map[k] = String(saved[k]); });
      setValues(map);
      setOriginal(map);
      await refreshPublic();
      toast.success(res.data.message ?? 'সেটিংস সংরক্ষণ হয়েছে');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const res = await adminApi.post('/admin/settings/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data.message ?? 'লোগো আপডেট হয়েছে');
      await load();
      await refreshPublic();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'লোগো আপলোড করা যায়নি'));
    } finally {
      setUploading(false);
    }
  };

  const resetLogo = async () => {
    try {
      const res = await adminApi.delete('/admin/settings/logo');
      toast.success(res.data.message ?? 'ডিফল্ট লোগোতে ফিরে গেছে');
      await load();
      await refreshPublic();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  if (loading) return <PageSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const groupKeys = Object.keys(groups);
  const fields = groups[activeGroup] ?? [];
  const editable = can('settings:write');

  const renderField = (def: Definition) => {
    const value = values[def.key] ?? '';
    const setValue = (v: string) => setValues((s) => ({ ...s, [def.key]: v }));
    const label = def.labelBn ? `${def.labelBn} (${def.label})` : def.label;

    if (def.type === 'boolean') {
      return (
        <div key={def.key} className="rounded-lg border border-gray-200 p-3">
          <Switch checked={value === 'true'} onChange={(v) => setValue(v ? 'true' : 'false')} label={label} disabled={!editable} />
        </div>
      );
    }
    if (def.type === 'text') {
      return <Textarea key={def.key} label={label} rows={3} value={value} onChange={(e) => setValue(e.target.value)} disabled={!editable} />;
    }
    if (def.key === 'free_shipping_scope') {
      return (
        <div key={def.key}>
          <label className="label">{label}</label>
          <select value={value} onChange={(e) => setValue(e.target.value)} disabled={!editable} className="field">
            <option value="inside_dhaka">শুধু ঢাকার ভিতরে</option>
            <option value="all">সব এলাকায়</option>
          </select>
          <p className="help">ঢাকার ভিতরে ৳{values.free_shipping_threshold || 0}+ অর্ডারে ফ্রি; বাইরে সবসময় চার্জ প্রযোজ্য (সার্ভারে এনফোর্স করা)।</p>
        </div>
      );
    }
    if (def.key === 'brand_color') {
      return (
        <div key={def.key}>
          <label className="label">{label}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={value || '#f97316'} onChange={(e) => setValue(e.target.value)} className="h-10 w-14 rounded border border-gray-300" aria-label="ব্র্যান্ড রঙ" />
            <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={!editable} />
          </div>
        </div>
      );
    }
    return (
      <Input
        key={def.key}
        label={label}
        type={def.type === 'number' ? 'number' : def.type === 'url' ? 'url' : 'text'}
        min={def.min ?? undefined}
        max={def.max ?? undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!editable}
      />
    );
  };

  return (
    <div className="pb-20">
      <PageHeader
        title="সেটিংস"
        subtitle="সব পরিবর্তন সার্ভারে সংরক্ষিত হয় এবং স্টোরফ্রন্টে সাথে সাথে প্রতিফলিত হয়"
        actions={
          editable ? (
            <>
              <Button variant="ghost" icon={RotateCcw} onClick={() => setValues(original)} disabled={!dirtyKeys.length}>ফিরিয়ে নিন</Button>
              <Button icon={Save} loading={saving} onClick={save} disabled={!dirtyKeys.length}>
                সংরক্ষণ{dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav className="card h-fit overflow-hidden py-1">
          {groupKeys.map((key) => {
            const meta = GROUP_META[key] ?? { label: key, icon: Info, hint: '' };
            return (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
                  activeGroup === key ? 'border-l-2 border-brand-500 bg-brand-50 font-medium text-brand-700' : 'text-ink-700 hover:bg-gray-50'
                )}
              >
                <meta.icon className="h-4 w-4" /> {meta.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-4">
          {activeGroup === 'branding' && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink-900">লোগো আপলোড</h2>
              <p className="mb-3 text-xs text-gray-500">PNG/JPG/WEBP, সর্বোচ্চ 5MB। আপলোডের পর স্টোরফ্রন্ট ও অ্যাডমিন — দুই জায়গায় নতুন লোগো দেখাবে।</p>
              <div className="flex flex-wrap items-center gap-3">
                <SmartImage src={mediaUrl(values.logo_url)} alt="logo" className="h-16 w-32 rounded-lg border border-gray-200 bg-white object-contain p-1" />
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50">
                  <Upload className="h-4 w-4" /> {uploading ? 'আপলোড হচ্ছে…' : 'নতুন লোগো'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)} disabled={!editable || uploading} />
                </label>
                <Button variant="ghost" onClick={resetLogo} disabled={!editable}>ডিফল্ট লোগো</Button>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-ink-900">{GROUP_META[activeGroup]?.label ?? activeGroup}</h2>
            <p className="mb-3 text-xs text-gray-500">{GROUP_META[activeGroup]?.hint}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(renderField)}
            </div>
            {activeGroup === 'shipping' && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">ফ্রি ডেলিভারির বর্তমান নিয়ম</p>
                <p className="mt-1">
                  {values.free_shipping_enabled === 'true'
                    ? `৳${values.free_shipping_threshold}+ অর্ডারে ফ্রি ডেলিভারি (${values.free_shipping_scope === 'all' ? 'সব এলাকা' : 'শুধু ঢাকার ভিতরে'})। ঢাকার বাইরে চার্জ ৳${values.outside_dhaka_charge}।`
                    : 'ফ্রি ডেলিভারি বন্ধ — সব অর্ডারে চার্জ প্রযোজ্য।'}
                </p>
                <p className="mt-1">এই নিয়ম সার্ভারে হিসাব হয়, তাই ক্লায়েন্ট থেকে বদলানো যায় না।</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {dirtyKeys.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-ink-900 px-4 py-2.5 text-white shadow-pop">
          <span className="text-sm">{dirtyKeys.length} টি পরিবর্তন সংরক্ষিত হয়নি</span>
          <Button size="sm" onClick={save} loading={saving}>সংরক্ষণ করুন</Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setValues(original)}>বাতিল</Button>
        </div>
      )}
    </div>
  );
}
