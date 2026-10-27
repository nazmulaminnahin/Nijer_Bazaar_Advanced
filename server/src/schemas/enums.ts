import { pgEnum } from 'drizzle-orm/pg-core';

export const adminRoleEnum = pgEnum('admin_role', [
  'super_admin', 'manager', 'sales_staff', 'warehouse_staff', 'support',
]);

export const customerSegmentEnum = pgEnum('customer_segment', [
  'new', 'regular', 'vip', 'inactive',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned',
]);

export const paymentMethodEnum = pgEnum('payment_method', ['bkash', 'nagad', 'cod', 'card']);

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'refunded']);

export const fulfillmentStageEnum = pgEnum('fulfillment_stage', [
  'pending', 'picking', 'packing', 'ready_to_ship', 'shipped',
]);

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'failed',
]);

export const couponTypeEnum = pgEnum('coupon_type', ['flat', 'percentage', 'free_shipping']);

export const inventoryLogTypeEnum = pgEnum('inventory_log_type', [
  'purchase', 'sale', 'return', 'adjustment', 'damaged', 'transfer',
]);

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'refund']);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email', 'sms', 'whatsapp', 'push', 'system',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending', 'sent', 'failed', 'read',
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft', 'scheduled', 'sending', 'sent', 'failed',
]);

export const loyaltyTypeEnum = pgEnum('loyalty_type', ['earned', 'redeemed', 'expired', 'adjusted']);