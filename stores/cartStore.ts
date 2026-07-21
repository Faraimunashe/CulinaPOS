import { create } from 'zustand';
import type { CartLine, PosProduct } from '@/types';

interface CartState {
  lines: CartLine[];
  currencyId: number | null;
  paymentMethodId: number | null;
  setCurrencyId: (id: number) => void;
  setPaymentMethodId: (id: number | null) => void;
  addProduct: (product: PosProduct, unitPrice: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  increment: (productId: number) => void;
  decrement: (productId: number) => void;
  removeLine: (productId: number) => void;
  clear: () => void;
  itemCount: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  currencyId: null,
  paymentMethodId: null,

  setCurrencyId: (id) => set({ currencyId: id }),
  setPaymentMethodId: (id) => set({ paymentMethodId: id }),

  addProduct: (product, unitPrice) => {
    if (!product.in_stock || product.max_quantity <= 0) return;
    const { lines } = get();
    const existing = lines.find((l) => l.product_id === product.id);
    if (existing) {
      if (existing.quantity >= existing.max_quantity) return;
      set({
        lines: lines.map((l) =>
          l.product_id === product.id
            ? {
                ...l,
                quantity: Math.min(l.quantity + 1, l.max_quantity),
                unit_price: unitPrice,
                max_quantity: product.max_quantity,
              }
            : l
        ),
      });
      return;
    }
    set({
      lines: [
        ...lines,
        {
          product_id: product.id,
          product_name: product.name,
          tracking_type: product.tracking_type,
          limiting_stock_name: product.limiting_stock_name,
          quantity: 1,
          unit_price: unitPrice,
          max_quantity: product.max_quantity,
        },
      ],
    });
  },

  setQuantity: (productId, quantity) => {
    const { lines } = get();
    const line = lines.find((l) => l.product_id === productId);
    if (!line) return;
    const next = Math.max(0, Math.min(Math.floor(quantity), line.max_quantity));
    if (next <= 0) {
      set({ lines: lines.filter((l) => l.product_id !== productId) });
      return;
    }
    set({
      lines: lines.map((l) =>
        l.product_id === productId ? { ...l, quantity: next } : l
      ),
    });
  },

  increment: (productId) => {
    const line = get().lines.find((l) => l.product_id === productId);
    if (!line) return;
    get().setQuantity(productId, line.quantity + 1);
  },

  decrement: (productId) => {
    const line = get().lines.find((l) => l.product_id === productId);
    if (!line) return;
    get().setQuantity(productId, line.quantity - 1);
  },

  removeLine: (productId) =>
    set({ lines: get().lines.filter((l) => l.product_id !== productId) }),

  clear: () => set({ lines: [], paymentMethodId: null }),

  itemCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),

  subtotal: () =>
    Math.round(
      get().lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0) * 100
    ) / 100,
}));
