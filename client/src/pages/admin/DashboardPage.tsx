import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, ArrowDownRight, ShoppingBag, Users, Package, Wallet, AlertTriangle,
  Clock, Truck, RefreshCw, TrendingUp,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { adminApi, getApiErrorMessage, mediaUrl } from '@/lib/api';
import { taka, number, dateTime, orderStatusLabel, orderStatusTone } from '@/lib/format';
import { useAdmin } from '@/store/admin';
import { Badge, Card, CardHeader, ErrorState, PageSpinner, SmartImage, StatCard, Table, Tbody, Td, Th, Thead, Tabs, EmptyState } from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

interface Stats {
  todayRevenue: number; todayOrders: number; totalRevenue: number; totalOrders: number;
  periodRevenue: number; periodOrders: number; averageOrderValue: number;
  revenueGrowth: number; ordersGrowth: number; pendingOrders: number; shippedOrders: number;
  totalCustomers: number; newCustomers: number; totalProducts: number; lowStockProducts: number;
  statusBreakdown: Record<string, number>; period: string; revenueRule: string;
}
interface TopProduct { id: number; name: string; image: string | null; soldCount: number; revenue: number }
interface RecentOrder { id: number; orderNumber: string; customerName: string; total: number; status: string; createdAt: string }
interface SalesPoint { date: string; revenue: number; orders: number; delivered: number; cancelled: number }

const PERIODS = [
  { value: '7d', label: '৭ দিন' },
  { value: '30d', label: '৩০ দিন' },
  { value: '90d', label: '৯০ দিন' },
  { value: '1y', label: '১ বছর' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#0ea5e9', processing: '#6366f1', shipped: '#8b5cf6',
  delivered: '#10b981', cancelled: '#ef4444', returned: '#9ca3af',
};

export default function DashboardPage() {
  const admin = useAdmin((s) => s.admin);
  const [period, setPeriod] = useState('30d');
  const [stats, setStats] = useState<Stats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<Array<{ id: number; name: string; sku: string; stock: number; lowStockThreshold: number }>>([]);
  const [sales, setSales] = useState<SalesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      adminApi.get(`/admin/dashboard?period=${period}`),
      adminApi.get('/admin/dashboard/top-products'),
      adminApi.get('/admin/dashboard/recent-orders'),
      adminApi.get('/admin/dashboard/low-stock'),
      adminApi.get(`/admin/reports/sales?period=${period}`),
    ])
      .then(([s, tp, ro, ls, sl]) => {
        setStats(s.data.stats);
        setTopProducts(tp.data.products ?? []);
        setRecent(ro.data.orders ?? []);
        setLowStock(ls.data.products ?? []);
        setSales(sl.data.salesData ?? []);
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  if (loading && !stats) return <PageSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  const statusData = Object.entries(stats.statusBreakdown).map(([status, value]) => ({
    name: orderStatusLabel(status), value, status,
  }));

  const Growth = ({ value }: { value: number }) => {
    const positive = value >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title={`স্বাগতম, ${admin?.name ?? 'অ্যাডমিন'}`}
        subtitle={`সর্বশেষ ${PERIODS.find((p) => p.value === period)?.label} এর পারফরম্যান্স`}
        actions={
          <>
            <Tabs value={period} onChange={setPeriod} tabs={PERIODS} />
            <button onClick={load} className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50" aria-label="রিফ্রেশ">
              <RefreshCw className="h-4 w-4" />
            </button>
          </>
        }
      />

      {/* KPI cards — all clickable */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard to="/admin/orders" label="আজকের অর্ডার" value={number(stats.todayOrders)} hint={`আজকের বিক্রি ${taka(stats.todayRevenue)}`} icon={ShoppingBag} tone="brand" />
        <StatCard to="/admin/orders?status=pending" label="পেন্ডিং অর্ডার" value={number(stats.pendingOrders)} hint="কনফার্ম করার অপেক্ষায়" icon={Clock} tone="amber" />
        <StatCard to="/admin/orders?status=shipped" label="শিপড অর্ডার" value={number(stats.shippedOrders)} hint="ডেলিভারির পথে" icon={Truck} tone="blue" />
        <StatCard to="/admin/accounting/transactions" label="মোট আয়" value={taka(stats.totalRevenue)} hint="বাতিল ও রিটার্ন বাদ দেওয়া হয়েছে" icon={Wallet} tone="green" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard to="/admin/reports" label={`${PERIODS.find((p) => p.value === period)?.label} আয়`} value={taka(stats.periodRevenue)} hint={<Growth value={stats.revenueGrowth} />} icon={TrendingUp} />
        <StatCard to="/admin/reports" label="অর্ডার (পিরিয়ড)" value={number(stats.periodOrders)} hint={<Growth value={stats.ordersGrowth} />} icon={ShoppingBag} />
        <StatCard to="/admin/customers" label="মোট কাস্টমার" value={number(stats.totalCustomers)} hint={`নতুন ${number(stats.newCustomers)} জন`} icon={Users} tone="blue" />
        <StatCard to="/admin/inventory?filter=low" label="স্টক কম" value={number(stats.lowStockProducts)} hint={`মোট পণ্য ${number(stats.totalProducts)}`} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="আয় ও অর্ডার ট্রেন্ড" subtitle="রিপোর্ট থেকে বাস্তব ডেটা" />
          <div className="h-64">
            {sales.length === 0 ? (
              <EmptyState title="এই সময়ে কোনো ডেটা নেই" description="নতুন অর্ডার এলে চার্ট দেখা যাবে।" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sales} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `৳${v / 1000}k`} />
                  <Tooltip formatter={(v: number, n) => [n === 'revenue' ? taka(v) : number(v), n === 'revenue' ? 'আয়' : 'অর্ডার']} labelFormatter={(l: string) => `তারিখ: ${l}`} />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="অর্ডার স্ট্যাটাস" subtitle="সব অর্ডারের বর্তমান অবস্থা" />
          <div className="h-64">
            {statusData.length === 0 ? (
              <EmptyState title="কোনো অর্ডার নেই" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {statusData.map((entry) => <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, n) => [number(v), n]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="সাম্প্রতিক অর্ডার" action={<Link to="/admin/orders" className="text-xs font-medium text-brand-600 hover:underline">সব দেখুন</Link>} />
          {recent.length === 0 ? (
            <EmptyState title="এখনো কোনো অর্ডার নেই" />
          ) : (
            <Table>
              <Thead><tr><Th>অর্ডার</Th><Th>কাস্টমার</Th><Th>স্ট্যাটাস</Th><Th className="text-right">মোট</Th></tr></Thead>
              <Tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <Td>
                      <Link to={`/admin/orders?search=${o.orderNumber}`} className="font-medium text-brand-600 hover:underline">{o.orderNumber}</Link>
                      <p className="text-[11px] text-gray-400">{dateTime(o.createdAt)}</p>
                    </Td>
                    <Td>{o.customerName || '—'}</Td>
                    <Td><Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge></Td>
                    <Td className="text-right font-semibold tnum">{taka(o.total)}</Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="বেস্ট সেলিং পণ্য" subtitle="বিক্রয় সংখ্যা অনুযায়ী" />
          {topProducts.length === 0 ? (
            <EmptyState title="এখনো কোনো বিক্রয় হয়নি" />
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <SmartImage src={mediaUrl(p.image)} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{p.name}</p>
                    <p className="text-[11px] text-gray-500">{number(p.soldCount)} টি বিক্রি হয়েছে</p>
                  </div>
                  <p className="text-sm font-semibold tnum">{taka(p.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="স্টক কম পণ্য" subtitle="দ্রুত রিস্টক করুন" action={<Link to="/admin/inventory?filter=low" className="text-xs font-medium text-brand-600 hover:underline">ইনভেন্টরি</Link>} />
          {lowStock.length === 0 ? (
            <EmptyState title="সব পণ্যের স্টক ঠিক আছে" />
          ) : (
            <Table>
              <Thead><tr><Th>পণ্য</Th><Th>SKU</Th><Th className="text-right">স্টক</Th></tr></Thead>
              <Tbody>
                {lowStock.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <Td className="font-medium">{p.name}</Td>
                    <Td className="text-gray-500">{p.sku}</Td>
                    <Td className="text-right">
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${p.stock === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{p.stock}</span>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="অর্ডার স্ট্যাটাস (সংখ্যায়)" />
          <div className="h-56">
            {statusData.length === 0 ? (
              <EmptyState title="কোনো ডেটা নেই" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [number(v), 'অর্ডার']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry) => <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
