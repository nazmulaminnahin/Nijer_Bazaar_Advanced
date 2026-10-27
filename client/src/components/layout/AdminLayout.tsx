import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, FolderTree, Boxes, Users, Gift, TicketPercent,
  Zap, BarChart3, ReceiptText, Wallet, UserCog, Bell, Settings, Truck, LogOut, Menu, X,
  ChevronDown, Search, Star, ExternalLink, ShieldCheck, ClipboardList,
} from 'lucide-react';
import { useAdmin } from '@/store/admin';
import { useSettings } from '@/store/settings';
import { adminApi, mediaUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  badgeKey?: 'pending';
}

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'প্রধান',
    items: [
      { to: '/admin/dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, permission: 'dashboard:read' },
      { to: '/admin/orders', label: 'অর্ডার', icon: ShoppingBag, permission: 'orders:read', badgeKey: 'pending' },
    ],
  },
  {
    title: 'পণ্য',
    items: [
      { to: '/admin/products', label: 'পণ্য তালিকা', icon: Package, permission: 'products:read' },
      { to: '/admin/categories', label: 'ক্যাটাগরি', icon: FolderTree, permission: 'categories:read' },
      { to: '/admin/inventory', label: 'ইনভেন্টরি', icon: Boxes, permission: 'inventory:read' },
    ],
  },
  {
    title: 'গ্রাহক',
    items: [
      { to: '/admin/customers', label: 'কাস্টমার', icon: Users, permission: 'customers:read' },
      { to: '/admin/testimonials', label: 'কাস্টমার রিভিউ', icon: Star, permission: 'settings:read' },
    ],
  },
  {
    title: 'প্রমোশন',
    items: [
      { to: '/admin/gift-cards', label: 'গিফট কার্ড', icon: Gift, permission: 'giftcards:read' },
      { to: '/admin/coupons', label: 'কুপন', icon: TicketPercent, permission: 'coupons:read' },
      { to: '/admin/flash-sales', label: 'ফ্ল্যাশ সেল', icon: Zap, permission: 'flashsales:read' },
    ],
  },
  {
    title: 'হিসাব ও রিপোর্ট',
    items: [
      { to: '/admin/reports', label: 'রিপোর্ট ও অ্যানালিটিক্স', icon: BarChart3, permission: 'reports:read' },
      { to: '/admin/accounting/transactions', label: 'লেনদেন', icon: ReceiptText, permission: 'accounting:read' },
      { to: '/admin/accounting/expenses', label: 'খরচ', icon: Wallet, permission: 'accounting:read' },
    ],
  },
  {
    title: 'ব্যবস্থাপনা',
    items: [
      { to: '/admin/staff', label: 'স্টাফ ও পে-রোল', icon: UserCog, permission: 'staff:read' },
      { to: '/admin/couriers', label: 'কুরিয়ার', icon: Truck, permission: 'couriers:read' },
      { to: '/admin/notifications', label: 'নোটিফিকেশন', icon: Bell, permission: 'notifications:read' },
      { to: '/admin/settings', label: 'সেটিংস', icon: Settings, permission: 'settings:read' },
    ],
  },
];

interface AdminNotification {
  id: string; type: string; title: string; message: string; href: string; createdAt: string;
}

export default function AdminLayout() {
  const { admin, logout, can } = useAdmin();
  const settings = useSettings((s) => s.settings);
  const loadSettings = useSettings((s) => s.load);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!useSettings.getState().loaded) void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setSidebarOpen(false);
    setBellOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Notification feed + pending badge come from real records.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [feed, stats] = await Promise.all([
          adminApi.get('/admin/dashboard/notifications'),
          adminApi.get('/orders/admin/stats'),
        ]);
        if (cancelled) return;
        setNotifications(feed.data.notifications ?? []);
        setPendingCount(stats.data.stats?.pending ?? 0);
      } catch {
        /* keep the shell usable if the feed fails */
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/admin/orders?search=${encodeURIComponent(query.trim())}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const roleLabel: Record<string, string> = {
    super_admin: 'সুপার অ্যাডমিন', manager: 'ম্যানেজার', staff: 'স্টাফ', support: 'সাপোর্ট',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-4">
          <Link to="/admin/dashboard" className="flex min-w-0 items-center gap-2">
            <img src={mediaUrl(settings.logo_alt_url)} alt="logo" className="h-9 w-9 rounded object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-900">{settings.site_name_bn}</p>
              <p className="text-[11px] text-gray-500">Admin &amp; Staff Panel</p>
            </div>
          </Link>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="মেনু বন্ধ"><X className="h-5 w-5" /></button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.permission || can(item.permission));
            if (!items.length) return null;
            return (
              <div key={section.title} className="mb-5">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{section.title}</p>
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-gray-50'
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.badgeKey === 'pending' && pendingCount > 0 && (
                          <span className="ml-auto rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingCount}</span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <Link to="/" target="_blank" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">
            <ExternalLink className="h-3.5 w-3.5" /> ওয়েবসাইট দেখুন
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="মেনু খুলুন">
            <Menu className="h-6 w-6 text-ink-700" />
          </button>

          <form onSubmit={onSearch} className="hidden max-w-sm flex-1 sm:block">
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 focus-within:border-brand-400 focus-within:bg-white">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="অর্ডার নম্বর / গ্রাহক খুঁজুন"
                aria-label="অর্ডার খুঁজুন"
                className="h-9 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <Badge tone="brand" className="hidden sm:inline-flex">
              <ShieldCheck className="h-3 w-3" /> {roleLabel[admin?.role ?? ''] ?? admin?.role}
            </Badge>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen((v) => !v); setProfileOpen(false); }}
                className="relative rounded-lg p-2 text-ink-700 hover:bg-gray-100"
                aria-label="নোটিফিকেশন"
                aria-expanded={bellOpen}
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-pop animate-fade-in">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                      <p className="text-sm font-semibold">নোটিফিকেশন</p>
                      <span className="text-xs text-gray-500">{notifications.length} টি</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-gray-500">কোনো নোটিফিকেশন নেই</p>
                      ) : (
                        notifications.map((n) => (
                          <Link
                            key={n.id}
                            to={n.href}
                            onClick={() => setBellOpen(false)}
                            className="block border-b border-gray-50 px-4 py-2.5 hover:bg-brand-50/60"
                          >
                            <p className="text-sm font-medium text-ink-900">{n.title}</p>
                            <p className="text-xs text-gray-500">{n.message}</p>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link to="/admin/notifications" onClick={() => setBellOpen(false)} className="block bg-gray-50 px-4 py-2 text-center text-xs font-medium text-brand-700 hover:bg-gray-100">
                      নোটিফিকেশন ম্যানেজার
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => { setProfileOpen((v) => !v); setBellOpen(false); }}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100"
                aria-label="প্রোফাইল"
                aria-expanded={profileOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {admin?.name?.charAt(0) ?? 'A'}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-gray-500 sm:block" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-pop animate-fade-in">
                    <div className="border-b border-gray-100 px-4 py-2.5">
                      <p className="truncate text-sm font-semibold">{admin?.name}</p>
                      <p className="truncate text-xs text-gray-500">{admin?.email || admin?.phone}</p>
                      <p className="mt-1 text-xs text-brand-600">{roleLabel[admin?.role ?? ''] ?? admin?.role}</p>
                    </div>
                    {can('staff:read') && (
                      <Link to="/admin/staff" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                        <UserCog className="h-4 w-4" /> স্টাফ প্রোফাইল
                      </Link>
                    )}
                    {can('settings:read') && (
                      <Link to="/admin/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                        <Settings className="h-4 w-4" /> সেটিংস
                      </Link>
                    )}
                    <Link to="/" target="_blank" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                      <ExternalLink className="h-4 w-4" /> ওয়েবসাইট
                    </Link>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> লগআউট
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
