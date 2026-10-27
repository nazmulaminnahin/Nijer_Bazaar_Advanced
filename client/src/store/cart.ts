import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  productId: number;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  stock: number;
  image: string | null;
  sku?: string;
}

interface CartState {
  items: CartLine[];
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
}

/**
 * Guest cart lives in the browser; at checkout the server re-prices every line,
 * so a tampered local price cannot change what is actually charged.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add(line, quantity = 1) {
        set((state) => {
          const existing = state.items.find((i) => i.productId === line.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === line.productId
                  ? { ...i, quantity: Math.min(line.stock || 99, i.quantity + quantity) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...line, quantity }] };
        });
      },
      setQuantity(productId, quantity) {
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(quantity, i.stock || 99) } : i)),
        }));
      },
      remove(productId) {
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) }));
      },
      clear() {
        set({ items: [] });
      },
      count() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0);
      },
      subtotal() {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      },
    }),
    { name: 'nb_cart' }
  )
);
