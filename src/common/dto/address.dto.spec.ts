import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AddressDto, normalisePostcode } from './address.dto';

const check = (postcode: string, phone: unknown = '+44 7700 900123') =>
  validateSync(
    plainToInstance(AddressDto, {
      line1: '1 High St',
      city: 'London',
      postcode,
      phone,
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

  describe('phone number', () => {
    it('is required', () => {
      expect(check('SW1A 2AA', null).length).toBeGreaterThan(0);
      expect(check('SW1A 2AA', '').length).toBeGreaterThan(0);
    });
    it.each(['+44 7700 900123', '07700900123', '(020) 7946-0000'])(
      'accepts %s',
      (ph) => {
        expect(check('SW1A 2AA', ph)).toHaveLength(0);
      },
    );
    it.each(['abc', '12', 'call me'])('rejects %s', (ph) => {
      expect(check('SW1A 2AA', ph).length).toBeGreaterThan(0);
    });
  });
});
