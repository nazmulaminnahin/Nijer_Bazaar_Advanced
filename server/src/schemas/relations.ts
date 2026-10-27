import { relations } from 'drizzle-orm';
import { users } from './users.schema';
import { addresses } from './addresses.schema';
import { cart } from './cart.schema';
import { wishlist } from './wishlist.schema';
import { categories } from './categories.schema';
import { products, productImages, productVariants } from './products.schema';
import { reviews } from './reviews.schema';
import { orders, orderItems, orderStatusHistory } from './orders.schema';
import { coupons, couponUsages } from './coupons.schema';
import { giftCards, giftCardTransactions } from './giftcards.schema';
import { loyaltyTransactions } from './loyalty.schema';
import { crmNotes } from './crm.schema';
import { notifications } from './notifications.schema';
import { couriers } from './couriers.schema';
import { transactions } from './accounting.schema';

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  reviews: many(reviews),
  cartItems: many(cart),
  wishlistItems: many(wishlist),
  crmNotes: many(crmNotes),
  loyaltyTransactions: many(loyaltyTransactions),
  notifications: many(notifications),
  giftCards: many(giftCards),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(productVariants),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  courier: one(couriers, { fields: [orders.courierId], references: [couriers.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
  history: many(orderStatusHistory),
  transactions: many(transactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const couponsRelations = relations(coupons, ({ many }) => ({
  usages: many(couponUsages),
}));

export const giftCardsRelations = relations(giftCards, ({ many }) => ({
  ledger: many(giftCardTransactions),
}));

export const cartRelations = relations(cart, ({ one }) => ({
  user: one(users, { fields: [cart.userId], references: [users.id] }),
  product: one(products, { fields: [cart.productId], references: [products.id] }),
}));

export const wishlistRelations = relations(wishlist, ({ one }) => ({
  user: one(users, { fields: [wishlist.userId], references: [users.id] }),
  product: one(products, { fields: [wishlist.productId], references: [products.id] }),
}));
