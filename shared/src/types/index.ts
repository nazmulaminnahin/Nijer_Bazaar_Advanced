// ============================
// AUTH & USER TYPES
// ============================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar?: string | null;
  role: string;
  isActive?: boolean;
  loyaltyPoints: number;
  createdAt: string;
}

export type UserData = User;

export interface AdminData {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user?: UserData;
    admin?: AdminData;
  };
}

// ============================
// CATEGORY & PRODUCT TYPES
// ============================
export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  parentId?: number | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured?: boolean;
  createdAt?: string;
}

export interface ProductImage {
  id: number;
  productId?: number;
  imageUrl: string;
  isMain: boolean;
  sortOrder?: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  categoryId?: number | null;
  price: number | string;
  salePrice?: number | string | null;
  comparePrice?: number | string | null;
  costPrice?: number | string | null;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  weight?: number | string | null;
  rating?: number | string;
  reviewCount?: number;
  tags?: string[];
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival?: boolean;
  isFlashSale?: boolean;
  flashSaleEndTime?: string | null;
  totalSold?: number;
  mainImage?: string | null;
  images?: string[];
  productImages?: ProductImage[];
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
}

// ============================
// ORDER & COURIER TYPES
// ============================
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
  city?: string;
  district: string;
  postalCode?: string;
}

export interface OrderItem {
  id: number;
  orderId?: number;
  productId?: number | null;
  name: string;
  productName?: string;
  variant?: string | null;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderStatusHistoryEntry {
  id: number;
  status: string;
  note?: string | null;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId?: number | null;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  tax?: number;
  total: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: ShippingAddress;
  billingAddress?: string | null;
  courierId?: number | null;
  trackingNumber?: string | null;
  courierTrackingId?: string | null;
  notes?: string | null;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Courier {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  trackingUrl?: string | null;
  insideDhakaCharge?: number;
  outsideDhakaCharge?: number;
  isActive: boolean;
  createdAt?: string;
}

// ============================
// PROMOTIONS & GIFT CARDS
// ============================
export interface Coupon {
  id: number;
  code: string;
  type: "percentage" | "fixed" | "flat";
  value: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  usageCount: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt?: string;
}

export interface GiftCard {
  id: number;
  code: string;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

// ============================
// DASHBOARD & ANALYTICS TYPES
// ============================
export interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
  revenueGrowth?: number;
  ordersGrowth?: number;
  customersGrowth?: number;
}

export interface SalesChartData {
  date: string;
  revenue: number;
  orders: number;
  avgOrderValue?: number;
}

export interface TopProduct {
  id: number;
  name: string;
  image?: string | null;
  soldCount: number;
  revenue: number;
  stock: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  sku?: string | null;
  stock: number;
  lowStockThreshold: number;
}

// ============================
// CART & GENERIC API TYPES
// ============================
export interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  price: number;
  selectedVariant?: string;
  product: Product;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}