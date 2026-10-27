import { useCallback, useEffect, useState } from 'react';
import { Download, TrendingUp, ShoppingBag, Users, Package, RefreshCw } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { adminApi, getApiErrorMessage } from '@/lib/api';
import { taka, number, dateOnly } from '@/lib/format';
import { toast } from '@/lib/toast';
import { Button, Card, CardHeader, EmptyState, Pagination, Select, StatCard, Table, Tbody, Td, Th, Thead, Tabs, PageSpinner } from '@/components/admin/ui';
import { PageHeader } from '@/components/layout/AdminLayout';

const PERIODS = [
  { value: '7d', label: '৭ দিন' },
  { value: '30d', label: '৩০ দিন' },
  { value: '90d', label: '৯০ দিন' },
  { value: '1y', label: '১ বছর' },
];

const COLORS = ['#f97316', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1'];

interface SalesPoint { date: string; revenue: number; orders: number; delivered: number; cancelled: number; avgOrderValue: number }
interface ProductRow { productId: number; name: string; sku: string; soldCount: number; revenue: number; orders: number; stock: number }
interface CategoryRow { category: string; revenue: number; units: number }
interface CustomerRow { date: string; newCustomers: number }
interface TopCustomer { userId: number | null; name: string; phone: string; orders: number; spent: number }

export default function ReportsPage() {
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SalesPoint[]>([]);
  const [summary, setSummary] = useState({ revenue: 0, orders: 0, delivered: 0, cancelled: 0, avgOrderValue: 0 });
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productSummary, setProductSummary] = useState({ products: 0, unitsSold: 0, revenue: 0 });
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [signups, setSignups] = useState<CustomerRow[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [customerTotals, setCustomerTotals] = useState<{ totalCustomers?: number; repeatCustomers?: number }>({});
  const [page, setPage] = useState(1);
  const productPageSize = 10;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.get(`/admin/reports/sales?period=${period}`),
      adminApi.get(`/admin/reports/products?period=${period}`),
      adminApi.get(`/admin/reports/categories?period=${period}`),
      adminApi.get(`/admin/reports/customers?period=${period}`),
    ])
      .then(([s, p, c, cu]) => {
        setSales(s.data.salesData ?? []);
        setSummary(s.data.summary ?? { revenue: 0, orders: 0, delivered: 0, cancelled: 0, avgOrderValue: 0 });
        setProducts(p.data.productsData ?? []);
        setProductSummary(p.data.summary ?? { products: 0, unitsSold: 0, revenue: 0 });
        setCategories(c.data.data ?? []);
        setSignups(cu.data.newCustomers ?? []);
        setTopCustomers(cu.data.topCustomers ?? []);
        setCustomerTotals({ totalCustomers: cu.data.totalCustomers, repeatCustomers: cu.data.repeatCustomers });
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = (rows: Array<Record<string, unknown>>, filename: string) => {
    if (!rows.length) { toast.info('এক্সপোর্ট করার ডেটা নেই'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const productSlice = products.slice((page - 1) * productPageSize, page * productPageSize);
  const deliveryRate = summary.orders ? ((summary.delivered / summary.orders) * 100).toFixed(1) : '0.0';

  return (
    <div>
      <PageHeader
        title="রিপোর্ট ও অ্যানালিটিক্স"
        subtitle="বাস্তব অর্ডার ডেটা থেকে হিসাব — বাতিল ও রিটার্ন বাদ দেওয়া হয়"
        actions={
          <>
            <Tabs value={period} onChange={(v) => { setPeriod(v); setPage(1); }} tabs={PERIODS} />
            <Button variant="outline" icon={RefreshCw} onClick={load}>রিফ্রেশ</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="আয়" value={taka(summary.revenue)} icon={TrendingUp} tone="green" />
        <StatCard label="অর্ডার" value={number(summary.orders)} icon={ShoppingBag} />
        <StatCard label="ডেলিভারি হার" value={`${deliveryRate}%`} hint={`${number(summary.delivered)} টি ডেলিভার্ড`} icon={Package} tone="blue" />
        <StatCard label="গড় অর্ডার মূল্য" value={taka(summary.avgOrderValue)} hint={`${number(summary.cancelled)} টি বাতিল/রিটার্ন`} icon={Users} tone="amber" />
      </div>

      {loading ? <PageSpinner /> : (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="দৈনিক বিক্রয়"
                subtitle={`${PERIODS.find((p) => p.value === period)?.label} — আয় ও অর্ডার`}
                action={<Button size="xs" variant="ghost" icon={Download} onClick={() => exportCsv(sales as unknown as Array<Record<string, unknown>>, `sales-${period}.csv`)}>CSV</Button>}
              />
              <div className="h-72">
                {sales.length === 0 ? <EmptyState title="এই সময়ে কোনো বিক্রয় নেই" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sales} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="ord2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `৳${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                      <Tooltip formatter={(v: number, n) => [n === 'revenue' ? taka(v) : number(v), n === 'revenue' ? 'আয়' : 'অর্ডার']} />
                      <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#rev2)" />
                      <Area type="monotone" dataKey="orders" stroke="#0ea5e9" strokeWidth={2} fill="url(#ord2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="ক্যাটাগরি মিক্স" subtitle="আয় অনুযায়ী" />
              <div className="h-72">
                {categories.length === 0 ? <EmptyState title="কোনো ডেটা নেই" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories} dataKey="revenue" nameKey="category" innerRadius={45} outerRadius={78} paddingAngle={2}>
                        {categories.map((c, i) => <Cell key={c.category} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => taka(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="নতুন কাস্টমার"
                subtitle="রেজিস্ট্রেশন ট্রেন্ড"
                action={<Button size="xs" variant="ghost" icon={Download} onClick={() => exportCsv(signups as unknown as Array<Record<string, unknown>>, `customers-${period}.csv`)}>CSV</Button>}
              />
              <div className="h-56">
                {signups.length === 0 ? <EmptyState title="এই সময়ে নতুন কাস্টমার নেই" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={signups} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v: number) => [number(v), 'নতুন কাস্টমার']} />
                      <Bar dataKey="newCustomers" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                মোট কাস্টমার {number(customerTotals.totalCustomers ?? 0)}
                {customerTotals.repeatCustomers != null && ` · পুনরায় ক্রয়কারী ${number(customerTotals.repeatCustomers)}`}
              </p>
            </Card>

            <Card>
              <CardHeader title="সেরা কাস্টমার" subtitle="সর্বোচ্চ ক্রয়" action={<Button size="xs" variant="ghost" icon={Download} onClick={() => exportCsv(topCustomers as unknown as Array<Record<string, unknown>>, `top-customers-${period}.csv`)}>CSV</Button>} />
              {topCustomers.length === 0 ? <EmptyState title="কোনো ডেটা নেই" /> : (
                <Table>
                  <Thead><tr><Th>#</Th><Th>কাস্টমার</Th><Th className="text-right">অর্ডার</Th><Th className="text-right">মোট ক্রয়</Th></tr></Thead>
                  <Tbody>
                    {topCustomers.slice(0, 8).map((c, i) => (
                      <tr key={`${c.userId}-${i}`}>
                        <Td className="tnum text-gray-400">{i + 1}</Td>
                        <Td><p className="font-medium">{c.name || '—'}</p><p className="text-[11px] text-gray-500">{c.phone}</p></Td>
                        <Td className="text-right tnum">{c.orders}</Td>
                        <Td className="text-right font-semibold tnum">{taka(c.spent)}</Td>
                      </tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader
              title="পণ্য পারফরম্যান্স"
              subtitle={`${number(productSummary.products)} টি পণ্য · ${number(productSummary.unitsSold)} ইউনিট · ${taka(productSummary.revenue)}`}
              action={<Button size="xs" variant="ghost" icon={Download} onClick={() => exportCsv(products as unknown as Array<Record<string, unknown>>, `products-${period}.csv`)}>CSV</Button>}
            />
            {products.length === 0 ? <EmptyState title="এই সময়ে কোনো বিক্রয় নেই" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <Thead><tr><Th>পণ্য</Th><Th>SKU</Th><Th className="text-right">বিক্রি</Th><Th className="text-right">অর্ডার</Th><Th className="text-right">আয়</Th><Th className="text-right">স্টক</Th></tr></Thead>
                  <Tbody>
                    {productSlice.map((p) => (
                      <tr key={p.productId} className="hover:bg-gray-50">
                        <Td className="font-medium">{p.name}</Td>
                        <Td className="text-xs text-gray-500">{p.sku}</Td>
                        <Td className="text-right tnum">{p.soldCount}</Td>
                        <Td className="text-right tnum text-gray-500">{p.orders}</Td>
                        <Td className="text-right font-semibold tnum">{taka(p.revenue)}</Td>
                        <Td className={`text-right tnum ${p.stock === 0 ? 'text-red-600' : ''}`}>{p.stock}</Td>
                      </tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            )}
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(products.length / productPageSize))} total={products.length} limit={productPageSize} onChange={setPage} />
          </Card>
        </>
      )}
    </div>
  );
}
