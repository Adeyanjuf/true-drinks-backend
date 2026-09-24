import { generateTrackingId, normaliseTrackingId } from './tracking-id';

describe('tracking ids', () => {
  it('has the DRK-XXXXX-XXXXX shape using only unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTrackingId()).toMatch(
        /^DRK-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/,
      );
    }
  });
  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateTrackingId));
    expect(ids.size).toBe(1000);
  });
  it('normalises sloppy input', () => {
    expect(normaliseTrackingId('drk 7qk2m x9h4t')).toBe('DRK-7QK2M-X9H4T');
    expect(normaliseTrackingId('7QK2MX9H4T')).toBe('DRK-7QK2M-X9H4T');
  });
});
