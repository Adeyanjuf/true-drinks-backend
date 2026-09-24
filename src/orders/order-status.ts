import { OrderStatus } from '@prisma/client';

// The only allowed path: PACKAGING -> OUT_FOR_DELIVERY -> DELIVERED.
const NEXT: Record<OrderStatus, OrderStatus | null> = {
  PACKAGING: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
  DELIVERED: null,
};

export const nextStatus = (from: OrderStatus) => NEXT[from];
export const canTransition = (from: OrderStatus, to: OrderStatus) =>
  NEXT[from] === to;

// Statuses that trigger a customer email (PACKAGING is covered by the receipt).
export const NOTIFIABLE_STATUSES: OrderStatus[] = [
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const customerStatusText: Record<
  OrderStatus,
  { title: string; description: string }
> = {
  PACKAGING: {
    title: 'Order confirmed',
    description: "We've received your order and are getting it packed.",
  },
  OUT_FOR_DELIVERY: {
    title: 'Out for delivery',
    description: 'Your order has left us and is on its way to you.',
  },
  DELIVERED: {
    title: 'Delivered',
    description: 'Your order has been delivered. Enjoy!',
  },
};
