import { useCallback, useEffect, useState } from 'react';
import { Plus, UserCog, Wallet, Pencil, Trash2, ShieldCheck, Banknote } from 'lucide-react';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateOnly, dateTime } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { toast } from '@/lib/toast';
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Select, StatCard, Switch, Table, Tbody, Td, Th, Thead, PageSpinner, Textarea, Tabs,
} from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Staff {
  id: number; name: string; email?: string | null; phone?: string | null; role: string; isActive: boolean;
  permissions: string[];
  profile: { designation?: string | null; department?: string | null; joinedAt?: string | null; employmentStatus?: string | null; monthlySalary?: number } | null;
  salaryPaid?: number; salaryPayments?: number;
  assignments: { total: number; completed: number; inProgress: number };
  lastLoginAt?: string | null;
}

const ROLES: Record<string, string> = { super_admin: 'সুপার অ্যাডমিন', manager: 'ম্যানেজার', staff: 'স্টাফ', support: 'সাপোর্ট' };

const empty = {
  name: '', email: '', phone: '', password: '', role: 'staff', isActive: true,
  designation: '', department: '', monthlySalary: '', employmentStatus: 'active',
};

export default function StaffPage() {
  const can = useAdmin((s) => s.can);
  const canSalary = can('staff:salary');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Staff | null>(null);

  const [salaryOpen, setSalaryOpen] = useState<Staff | null>(null);
  const [salaryData, setSalaryData] = useState<{ monthlySalary: number; payments: Array<Record<string, any>> }>({ monthlySalary: 0, payments: [] });
  const [salaryForm, setSalaryForm] = useState({ periodMonth: new Date().toISOString().slice(0, 7), amount: '', bonus: '', deduction: '', method: 'cash', note: '' });
  const [logs, setLogs] = useState<Array<Record<string, any>>>([]);
  const [tab, setTab] = useState<'staff' | 'logs'>('staff');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get('/admin/staff')
      .then((res) => {
        setStaff(res.data.staff ?? []);
        setRoles(res.data.roles ?? []);
        setPermissions(res.data.permissions ?? []);
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
    adminApi.get('/admin/staff/logs?limit=100').then((res) => setLogs(res.data.logs ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty });
    setSelectedPermissions([]);
    setError('');
    setOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      name: s.name, email: s.email ?? '', phone: s.phone ?? '', password: '', role: s.role, isActive: s.isActive,
      designation: s.profile?.designation ?? '', department: s.profile?.department ?? '',
      monthlySalary: s.profile?.monthlySalary != null ? String(s.profile.monthlySalary) : '',
      employmentStatus: s.profile?.employmentStatus ?? 'active',
    });
    setSelectedPermissions(s.permissions ?? []);
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email || '',
        phone: form.phone,
        role: form.role,
        isActive: form.isActive,
        permissions: selectedPermissions,
        designation: form.designation || undefined,
        department: form.department || undefined,
        monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined,
        employmentStatus: form.employmentStatus,
      };
      if (form.password) payload.password = form.password;
      if (editing) {
        await adminApi.put(`/admin/staff/${editing.id}`, payload);
        toast.success('স্টাফ আপডেট হয়েছে');
      } else {
        if (!form.password) { setError('নতুন স্টাফের জন্য পাসওয়ার্ড দিন (কমপক্ষে ৮ অক্ষর)।'); setSaving(false); return; }
        await adminApi.post('/admin/staff', payload);
        toast.success('স্টাফ যোগ হয়েছে');
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openSalary = async (s: Staff) => {
    setSalaryOpen(s);
    setSalaryForm({ periodMonth: new Date().toISOString().slice(0, 7), amount: s.profile?.monthlySalary ? String(s.profile.monthlySalary) : '', bonus: '', deduction: '', method: 'cash', note: '' });
    try {
      const res = await adminApi.get(`/admin/staff/${s.id}/salary`);
      setSalaryData({ monthlySalary: res.data.monthlySalary ?? 0, payments: res.data.payments ?? [] });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const paySalary = async () => {
    if (!salaryOpen) return;
    setSaving(true);
    try {
      await adminApi.post(`/admin/staff/${salaryOpen.id}/salary`, {
        periodMonth: salaryForm.periodMonth,
        amount: Number(salaryForm.amount),
        bonus: salaryForm.bonus ? Number(salaryForm.bonus) : undefined,
        deduction: salaryForm.deduction ? Number(salaryForm.deduction) : undefined,
        method: salaryForm.method,
        note: salaryForm.note || undefined,
      });
      toast.success('বেতন রেকর্ড করা হয়েছে');
      await openSalary(salaryOpen);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/admin/staff/${deleting.id}`);
      toast.success('স্টাফ মুছে ফেলা হয়েছে');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const totalSalary = staff.reduce((s, x) => s + (x.salaryPaid ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="স্টাফ ও পে-রোল"
        subtitle="অ্যাডমিন, স্টাফ, পারমিশন ও বেতন ব্যবস্থাপনা"
        actions={can('staff:write') ? <Button icon={Plus} onClick={openCreate}>নতুন স্টাফ</Button> : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="মোট স্টাফ" value={number(staff.length)} icon={UserCog} />
        <StatCard label="সক্রিয়" value={number(staff.filter((s) => s.isActive).length)} icon={ShieldCheck} tone="green" />
        {canSalary && <StatCard label="মোট বেতন প্রদান" value={taka(totalSalary)} icon={Wallet} tone="blue" />}
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'staff', label: 'স্টাফ তালিকা' }, { value: 'logs', label: 'কার্যক্রম লগ' }]} className="mb-3" />

      {tab === 'staff' ? (
        loading ? <PageSpinner /> : staff.length === 0 ? (
          <EmptyState title="কোনো স্টাফ নেই" />
        ) : (
          <div className="card overflow-x-auto">
            <Table>
              <Thead><tr><Th>নাম</Th><Th>রোল</Th><Th>পদবী</Th><Th>যোগাযোগ</Th><Th>অ্যাসাইনমেন্ট</Th>{canSalary && <Th className="text-right">বেতন</Th>}<Th>স্ট্যাটাস</Th><Th className="text-right">অ্যাকশন</Th></tr></Thead>
              <Tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <Td>
                      <p className="font-medium text-ink-900">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.lastLoginAt ? `শেষ লগইন ${dateTime(s.lastLoginAt)}` : 'লগইন করেননি'}</p>
                    </Td>
                    <Td><Badge tone={s.role === 'super_admin' ? 'brand' : s.role === 'manager' ? 'blue' : 'gray'}>{ROLES[s.role] ?? s.role}</Badge></Td>
                    <Td className="text-xs">{s.profile?.designation || '—'}<p className="text-gray-400">{s.profile?.department}</p></Td>
                    <Td className="text-xs">{s.phone}<p className="text-gray-400">{s.email || '—'}</p></Td>
                    <Td className="text-xs tnum">{s.assignments.completed}/{s.assignments.total} সম্পন্ন</Td>
                    {canSalary && <Td className="text-right tnum">{taka(s.salaryPaid ?? 0)}<p className="text-[11px] text-gray-400">{s.salaryPayments ?? 0} বার</p></Td>}
                    <Td><Badge tone={s.isActive ? 'green' : 'red'}>{s.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {canSalary && <button onClick={() => openSalary(s)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="বেতন"><Banknote className="h-4 w-4" /></button>}
                        {can('staff:write') && (
                          <>
                            <button onClick={() => openEdit(s)} className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600" aria-label="সম্পাদনা"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => setDeleting(s)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="মুছুন"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )
      ) : (
        logs.length === 0 ? <EmptyState title="কোনো লগ নেই" /> : (
          <div className="card overflow-x-auto">
            <Table>
              <Thead><tr><Th>সময়</Th><Th>স্টাফ</Th><Th>কাজ</Th><Th>মডিউল</Th><Th>টার্গেট</Th><Th>IP</Th></tr></Thead>
              <Tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <Td className="text-xs text-gray-500">{dateTime(l.createdAt)}</Td>
                    <Td className="text-xs">{l.adminName ?? l.adminId ?? '—'}</Td>
                    <Td className="text-xs font-medium">{l.action}</Td>
                    <Td className="text-xs">{l.module}</Td>
                    <Td className="text-xs text-gray-500">{l.targetId ?? '—'}</Td>
                    <Td className="font-mono text-[11px] text-gray-400">{l.ip ?? '—'}</Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )
      )}

      {/* Create / edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'স্টাফ সম্পাদনা' : 'নতুন স্টাফ'}
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button><Button loading={saving} onClick={save}>সংরক্ষণ</Button></>}
      >
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="নাম" requiredMark value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="মোবাইল" requiredMark value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" />
          <Input label="ইমেইল" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label={editing ? 'নতুন পাসওয়ার্ড (ঐচ্ছিক)' : 'পাসওয়ার্ড'} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} hint="কমপক্ষে ৮ অক্ষর" />
          <Select label="রোল" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} options={(roles.length ? roles : Object.keys(ROLES)).map((r) => ({ value: r, label: ROLES[r] ?? r }))} />
          <Input label="পদবী" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
          <Input label="বিভাগ" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
          <Input label="মাসিক বেতন (৳)" type="number" value={form.monthlySalary} onChange={(e) => setForm((f) => ({ ...f, monthlySalary: e.target.value }))} />
          <Select label="চাকরির অবস্থা" value={form.employmentStatus} onChange={(e) => setForm((f) => ({ ...f, employmentStatus: e.target.value }))} options={[
            { value: 'active', label: 'সক্রিয়' }, { value: 'probation', label: 'প্রোবেশন' }, { value: 'resigned', label: 'রিজাইন' }, { value: 'terminated', label: 'বরখাস্ত' },
          ]} />
          <div className="flex items-center"><Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="লগইন সক্রিয়" /></div>
          <div className="sm:col-span-2">
            <p className="label">অতিরিক্ত পারমিশন ({selectedPermissions.length})</p>
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-gray-200 p-2 text-xs sm:grid-cols-3">
              {permissions.map((p) => (
                <label key={p} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(p)}
                    onChange={() => setSelectedPermissions((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-500"
                  />
                  <span className="truncate">{p}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Salary */}
      <Modal open={Boolean(salaryOpen)} onClose={() => setSalaryOpen(null)} title={salaryOpen ? `বেতন — ${salaryOpen.name}` : ''} size="lg">
        <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
          মাসিক বেতন: <span className="font-semibold tnum">{taka(salaryData.monthlySalary)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="মাস (YYYY-MM)" value={salaryForm.periodMonth} onChange={(e) => setSalaryForm((f) => ({ ...f, periodMonth: e.target.value }))} />
          <Input label="বেতন (৳)" type="number" value={salaryForm.amount} onChange={(e) => setSalaryForm((f) => ({ ...f, amount: e.target.value }))} />
          <Select label="পদ্ধতি" value={salaryForm.method} onChange={(e) => setSalaryForm((f) => ({ ...f, method: e.target.value }))} options={[
            { value: 'cash', label: 'ক্যাশ' }, { value: 'bkash', label: 'বিকাশ' }, { value: 'nagad', label: 'নগদ' }, { value: 'bank', label: 'ব্যাংক' },
          ]} />
          <Input label="বোনাস (৳)" type="number" value={salaryForm.bonus} onChange={(e) => setSalaryForm((f) => ({ ...f, bonus: e.target.value }))} />
          <Input label="কর্তন (৳)" type="number" value={salaryForm.deduction} onChange={(e) => setSalaryForm((f) => ({ ...f, deduction: e.target.value }))} />
          <div className="flex items-end"><Button loading={saving} onClick={paySalary} className="w-full">বেতন রেকর্ড</Button></div>
          <div className="sm:col-span-3"><Textarea label="নোট" rows={2} value={salaryForm.note} onChange={(e) => setSalaryForm((f) => ({ ...f, note: e.target.value }))} /></div>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-gray-500">পেমেন্ট হিস্টরি ({salaryData.payments.length})</p>
          {salaryData.payments.length === 0 ? <p className="text-sm text-gray-500">এখনো কোনো বেতন রেকর্ড হয়নি।</p> : (
            <Table>
              <Thead><tr><Th>মাস</Th><Th className="text-right">বেতন</Th><Th className="text-right">বোনাস</Th><Th className="text-right">কর্তন</Th><Th>পদ্ধতি</Th><Th>তারিখ</Th></tr></Thead>
              <Tbody>
                {salaryData.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium">{p.periodMonth}</Td>
                    <Td className="text-right tnum">{taka(p.amount)}</Td>
                    <Td className="text-right tnum">{taka(p.bonus)}</Td>
                    <Td className="text-right tnum">{taka(p.deduction)}</Td>
                    <Td className="text-xs">{p.method}</Td>
                    <Td className="text-xs text-gray-500">{dateOnly(p.paidAt)}</Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="স্টাফ মুছে ফেলবেন?" message={`${deleting?.name} এর অ্যাকাউন্ট মুছে ফেলা হবে।`} confirmLabel="মুছে ফেলুন" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
