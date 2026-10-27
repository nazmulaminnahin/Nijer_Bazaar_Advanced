import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Search, User, Heart, Menu, X, ChevronDown, Phone, MapPin,
  LogOut, Package, Home, Store, Truck, Info, Mail, UserCog,
} from 'lucide-react';
import { useCart } from '@/store/cart';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { mediaUrl } from '@/lib/api';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const NAV = [
  { label: 'হোম', to: '/', icon: Home },
  { label: 'সব পণ্য', to: '/shop', icon: Store },
  { label: 'অর্ডার ট্র্যাক', to: '/track', icon: Truck },
  { label: 'আমাদের সম্পর্কে', to: '/about', icon: Info },
  { label: 'যোগাযোগ', to: '/contact', icon: Mail },
];

export default function CustomerLayout() {
  const settings = useSettings((s) => s.settings);
  const load = useSettings((s) => s.load);
  const cartCount = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!useSettings.getState().loaded) void load();
  }, [load]);

  useEffect(() => {
    document.title = `${settings.site_name_bn} — ${settings.site_tagline}`;
    const icon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (icon && settings.favicon_url) icon.href = mediaUrl(settings.favicon_url);
  }, [settings]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/shop?search=${encodeURIComponent(search.trim())}`);
      setSearchOpen(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top bar */}
      {settings.header_topbar_enabled === 'true' && (
        <div className="hidden bg-ink-900 text-white md:block">
          <div className="container-page flex h-9 items-center justify-between text-xs">
            <div className="flex items-center gap-5">
              <a href={`tel:${settings.header_phone}`} className="flex items-center gap-1.5 hover:text-brand-300">
                <Phone className="h-3.5 w-3.5" /> {settings.header_phone}
              </a>
              <span className="flex items-center gap-1.5 text-gray-300">
                <MapPin className="h-3.5 w-3.5" /> {settings.header_address}
              </span>
            </div>
            <p className="text-brand-200">{settings.header_promo_text}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-3 sm:gap-5">
          <button className="lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="মেনু">
            {menuOpen ? <X className="h-6 w-6 text-ink-700" /> : <Menu className="h-6 w-6 text-ink-700" />}
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img
              src={mediaUrl(settings.logo_url)}
              alt={settings.site_name}
              className="h-9 w-auto object-contain sm:h-10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="hidden text-lg font-bold text-ink-900 sm:block">
              {settings.site_name_bn}
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 md:block">
            <div className="flex w-full max-w-2xl overflow-hidden rounded-full border border-gray-300 bg-gray-50 focus-within:border-brand-400 focus-within:bg-white">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="পণ্য খুঁজুন…"
                aria-label="পণ্য খুঁজুন"
                className="h-10 flex-1 bg-transparent px-4 text-sm outline-none"
              />
              <button type="submit" className="bg-brand-500 px-5 text-white transition hover:bg-brand-600" aria-label="খুঁজুন">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button className="rounded-lg p-2 text-ink-700 hover:bg-gray-100 md:hidden" onClick={() => setSearchOpen((v) => !v)} aria-label="খুঁজুন">
              <Search className="h-5 w-5" />
            </button>

            <Link to={token ? '/profile?tab=wishlist' : '/login?next=/profile?tab=wishlist'} className="hidden rounded-lg p-2 text-ink-700 hover:bg-gray-100 sm:block" aria-label="উইশলিস্ট">
              <Heart className="h-5 w-5" />
            </Link>

            <Link to="/cart" className="relative rounded-lg p-2 text-ink-700 hover:bg-gray-100" aria-label="কার্ট">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative">
                <button onClick={() => setUserOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg p-1.5 hover:bg-gray-100" aria-label="অ্যাকাউন্ট">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-gray-500 sm:block" />
                </button>
                {userOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-pop animate-fade-in">
                      <div className="border-b border-gray-100 px-4 py-2.5">
                        <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
                        <p className="truncate text-xs text-gray-500">{user.phone || user.email}</p>
                      </div>
                      {[
                        { to: '/profile', icon: User, label: 'আমার প্রোফাইল' },
                        { to: '/profile?tab=orders', icon: Package, label: 'আমার অর্ডার' },
                        { to: '/profile?tab=wishlist', icon: Heart, label: 'উইশলিস্ট' },
                        { to: '/profile?tab=addresses', icon: MapPin, label: 'ঠিকানা' },
                        { to: '/track', icon: Truck, label: 'অর্ডার ট্র্যাক' },
                      ].map((item) => (
                        <Link key={item.to} to={item.to} onClick={() => setUserOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700">
                          <item.icon className="h-4 w-4" /> {item.label}
                        </Link>
                      ))}
                      <button
                        onClick={() => { logout(); setUserOpen(false); navigate('/'); }}
                        className="flex w-full items-center gap-2.5 border-t border-gray-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" /> লগআউট
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="ml-1 flex items-center gap-2">
                <Link to="/login" className="hidden sm:block"><Button variant="outline" size="sm" icon={User}>লগইন</Button></Link>
                <Link to="/register"><Button size="sm">রেজিস্টার</Button></Link>
              </div>
            )}
          </div>
        </div>

        {/* Desktop nav (অ্যাডমিন প্যানেল লিংকটি এখানে সম্পূর্ণ সরিয়ে দেওয়া হয়েছে) */}
        <nav className="hidden border-t border-gray-100 lg:block">
          <div className="container-page flex h-11 items-center gap-6">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => cn('flex items-center gap-1.5 text-sm font-medium transition-colors', isActive ? 'text-brand-600' : 'text-ink-700 hover:text-brand-600')}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Mobile search */}
        {searchOpen && (
          <div className="border-t border-gray-100 p-3 md:hidden">
            <form onSubmit={submitSearch} className="flex overflow-hidden rounded-full border border-gray-300">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="পণ্য খুঁজুন…" className="h-10 flex-1 px-4 text-sm outline-none" autoFocus />
              <button type="submit" className="bg-brand-500 px-4 text-white" aria-label="খুঁজুন"><Search className="h-4 w-4" /></button>
            </form>
          </div>
        )}

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-gray-100 bg-white lg:hidden">
            <div className="container-page flex flex-col py-2">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-brand-50"
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                </NavLink>
              ))}
              {user && (
                <>
                  <NavLink to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-brand-50">
                    <UserCog className="h-4 w-4" /> আমার প্রোফাইল
                  </NavLink>
                  <button onClick={() => { logout(); setMenuOpen(false); navigate('/'); }} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> লগআউট
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
      <MobileTabBar cartCount={cartCount} loggedIn={Boolean(token)} />
    </div>
  );
}

function MobileTabBar({ cartCount, loggedIn }: { cartCount: number; loggedIn: boolean }) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-4">
        {[
          { to: '/', label: 'হোম', icon: Home },
          { to: '/shop', label: 'পণ্য', icon: Store },
          { to: '/cart', label: 'কার্ট', icon: ShoppingCart, badge: cartCount },
          { to: loggedIn ? '/profile' : '/login', label: loggedIn ? 'প্রোফাইল' : 'লগইন', icon: User },
        ].map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-brand-600' : 'text-gray-500')}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
            {item.badge ? (
              <span className="absolute right-1/4 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function Footer() {
  const settings = useSettings((s) => s.settings);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-gray-200 bg-ink-900 text-gray-300">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <img src={mediaUrl(settings.logo_url)} alt={settings.site_name} className="mb-3 h-10 w-auto rounded bg-white p-1" />
          <p className="text-sm leading-relaxed text-gray-400">{settings.footer_slogan}</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{settings.footer_about}</p>
          <div className="mt-3 flex gap-2">
            {settings.facebook_url && (
              <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">Facebook</a>
            )}
            {settings.instagram_url && (
              <a href={settings.instagram_url} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">Instagram</a>
            )}
            {settings.youtube_url && (
              <a href={settings.youtube_url} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">YouTube</a>
            )}
            {settings.whatsapp_number && (
              <a href={`https://wa.me/88${settings.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs hover:bg-emerald-600">WhatsApp</a>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">দ্রুত লিংক</h4>
          <ul className="space-y-2 text-sm">
            {[{ to: '/shop', label: 'সব পণ্য' }, { to: '/track', label: 'অর্ডার ট্র্যাকিং' }, { to: '/about', label: 'আমাদের সম্পর্কে' }, { to: '/contact', label: 'যোগাযোগ' }, { to: '/profile', label: 'আমার অ্যাকাউন্ট' }].map((l) => (
              <li key={l.to}><Link to={l.to} className="text-gray-400 hover:text-brand-300">{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">গ্রাহক সেবা</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {settings.contact_phone}</li>
            <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {settings.contact_email}</li>
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {settings.contact_address}</li>
            <li className="text-xs text-gray-500">{settings.support_hours}</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">ডেলিভারি ও পেমেন্ট</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>ঢাকার ভিতরে: ৳{settings.inside_dhaka_charge}</li>
            <li>ঢাকার বাইরে: ৳{settings.outside_dhaka_charge}</li>
            <li>
              {settings.free_shipping_enabled === 'true'
                ? `৳${settings.free_shipping_threshold}+ অর্ডারে ফ্রি ডেলিভারি${settings.free_shipping_scope === 'all' ? '' : ' (ঢাকার ভিতরে)'}`
                : 'ফ্রি ডেলিভারি বর্তমানে বন্ধ'}
            </li>
            <li className="pt-1 text-xs text-gray-500">পেমেন্ট: ক্যাশ অন ডেলিভারি, বিকাশ, নগদ</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="container-page flex flex-col items-center justify-between gap-2 text-xs text-gray-500 sm:flex-row">
          <p>© {year} {settings.site_name}. সর্বস্বত্ব সংরক্ষিত।</p>
          <p className="font-medium text-gray-400">{settings.footer_attribution}</p>
        </div>
      </div>
    </footer>
  );
}