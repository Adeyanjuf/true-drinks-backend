import * as crypto from 'crypto';

// Crockford base32: no I, L, O, U, so IDs are easy to read out over the phone.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** e.g. DRK-7QK2M-X9H4T: 50 bits of randomness, not guessable or sequential. */
export function generateTrackingId(): string {
  const bytes = crypto.randomBytes(10);
  // 256 is a multiple of 32, so this modulo introduces no bias.
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
  return `DRK-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/** Accepts sloppy input: lowercase, spaces, missing hyphens. */
export function normaliseTrackingId(input: string): string {
  const compact = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const body = compact.startsWith('DRK') ? compact.slice(3) : compact;
  return `DRK-${body.slice(0, 5)}-${body.slice(5)}`;
}
