import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import CustomerLayout from '@/components/layout/CustomerLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useAdmin } from '@/store/admin';
import { useSettings } from '@/store/settings';

const HomePage = lazy(() => import('@/pages/customer/HomePage'));
const ShopPage = lazy(() => import('@/pages/customer/ShopPage'));
const ProductDetailPage = lazy(() => import('@/pages/customer/ProductDetailPage'));
const CartPage = lazy(() => import('@/pages/customer/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/customer/CheckoutPage'));
const LoginPage = lazy(() => import('@/pages/customer/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/customer/RegisterPage'));
const ProfilePage = lazy(() => import('@/pages/customer/ProfilePage'));
const TrackOrderPage = lazy(() => import('@/pages/customer/TrackOrderPage'));
const AboutPage = lazy(() => import('@/pages/customer/AboutPage'));
const ContactPage = lazy(() => import('@/pages/customer/ContactPage'));
const NotFoundPage = lazy(() => import('@/pages/customer/NotFoundPage'));

const AdminLoginPage = lazy(() => import('@/pages/admin/LoginPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/ProductsPage'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage'));
const AdminInventoryPage = lazy(() => import('@/pages/admin/InventoryPage'));
const AdminCustomersPage = lazy(() => import('@/pages/admin/CustomersPage'));
const AdminCouponsPage = lazy(() => import('@/pages/admin/CouponsPage'));
const AdminGiftCardsPage = lazy(() => import('@/pages/admin/GiftCardsPage'));
const AdminFlashSalesPage = lazy(() => import('@/pages/admin/FlashSalesPage'));
const AdminTransactionsPage = lazy(() => import('@/pages/admin/TransactionsPage'));
const AdminExpensesPage = lazy(() => import('@/pages/admin/ExpensesPage'));
const AdminReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const AdminStaffPage = lazy(() => import('@/pages/admin/StaffPage'));
const AdminCouriersPage = lazy(() => import('@/pages/admin/CouriersPage'));
const AdminNotificationsPage = lazy(() => import('@/pages/admin/NotificationsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const AdminReviewsPage = lazy(() => import('@/pages/admin/ReviewsPage'));

function RequireCustomer({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const token = useAdmin((s) => s.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  const loadSettings = useSettings((s) => s.load);
  const loaded = useSettings((s) => s.loaded);
  const siteName = useSettings((s) => s.settings.site_name_bn);

  useEffect(() => {
    if (!loaded) void loadSettings();
  }, [loaded, loadSettings]);

  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Spinner className="py-32" />}>
        <Routes>
          <Route element={<CustomerLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<RequireCustomer><CheckoutPage /></RequireCustomer>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/profile" element={<RequireCustomer><ProfilePage /></RequireCustomer>} />
            <Route path="/order-success" element={<RequireCustomer><ProfilePage /></RequireCustomer>} />
            <Route path="/track" element={<TrackOrderPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="inventory" element={<AdminInventoryPage />} />
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="testimonials" element={<AdminReviewsPage />} />
            <Route path="coupons" element={<AdminCouponsPage />} />
            <Route path="gift-cards" element={<AdminGiftCardsPage />} />
            <Route path="flash-sales" element={<AdminFlashSalesPage />} />
            <Route path="accounting/transactions" element={<AdminTransactionsPage />} />
            <Route path="accounting/expenses" element={<AdminExpensesPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="staff" element={<AdminStaffPage />} />
            <Route path="couriers" element={<AdminCouriersPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
