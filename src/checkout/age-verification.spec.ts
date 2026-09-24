import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AgeVerificationService,
  DobSelfDeclaredProvider,
  isAtLeastAge,
} from './age-verification';

describe('isAtLeastAge', () => {
  const now = new Date('2026-09-24T12:00:00Z');
  it('accepts exactly 18 today and rejects one day short', () => {
    expect(isAtLeastAge(new Date('2008-09-24T00:00:00Z'), 18, now)).toBe(true);
    expect(isAtLeastAge(new Date('2008-09-25T00:00:00Z'), 18, now)).toBe(false);
  });
});

describe('AgeVerificationService', () => {
  const service = new AgeVerificationService(new DobSelfDeclaredProvider());

  it('passes an adult and reports the method (no DOB retained)', async () => {
    await expect(service.assertOldEnough('1990-04-23')).resolves.toEqual({
      passed: true,
      method: 'dob_self_declared',
    });
  });
  it('blocks under-18s', async () => {
    const year = new Date().getUTCFullYear() - 10;
    await expect(service.assertOldEnough(`${year}-01-01`)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('requires a valid, non-future DOB', async () => {
    await expect(service.assertOldEnough(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.assertOldEnough('not-a-date')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.assertOldEnough('2999-01-01')).rejects.toThrow(
      BadRequestException,
    );
  });
});
