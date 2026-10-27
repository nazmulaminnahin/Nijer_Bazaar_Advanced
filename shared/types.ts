// Shared types between client and server
// This file can be imported in both places

export type UserRole = 'customer';

export type AdminRole =
  | 'super_admin'
  | 'manager'
  | 'sales_staff'
  | 'warehouse_staff'
  | 'support';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentMethod = 'bkash' | 'nagad' | 'cod' | 'card';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type CouponType = 'flat' | 'percentage' | 'free_shipping';