import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AddressDto, normalisePostcode } from './address.dto';

const check = (postcode: string) =>
  validateSync(
    plainToInstance(AddressDto, {
      line1: '1 High St',
      city: 'London',
      postcode,
    }),
  );

describe('UK postcode handling', () => {
  it('normalises spacing and case', () => {
    expect(normalisePostcode('sw1a2aa')).toBe('SW1A 2AA');
    expect(normalisePostcode('m1 1ae')).toBe('M1 1AE');
  });
  it.each(['SW1A 2AA', 'sw1a2aa', 'M1 1AE', 'B33 8TH', 'EC1A 1BB', 'GIR 0AA'])(
    'accepts %s',
    (pc) => {
      expect(check(pc)).toHaveLength(0);
    },
  );
  it.each(['12345', 'ZZ99 9ZZ9', 'hello', '', 'SW1A'])('rejects %s', (pc) => {
    expect(check(pc).length).toBeGreaterThan(0);
  });
});
