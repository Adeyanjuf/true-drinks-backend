import { canTransition, nextStatus } from './order-status';

describe('order status path', () => {
  it('only allows PACKAGING -> OUT_FOR_DELIVERY -> DELIVERED', () => {
    expect(canTransition('PACKAGING', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });
  it.each([
    ['PACKAGING', 'DELIVERED'],
    ['OUT_FOR_DELIVERY', 'PACKAGING'],
    ['DELIVERED', 'OUT_FOR_DELIVERY'],
    ['DELIVERED', 'PACKAGING'],
    ['PACKAGING', 'PACKAGING'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
  it('has nothing after DELIVERED', () => {
    expect(nextStatus('DELIVERED')).toBeNull();
  });
});
