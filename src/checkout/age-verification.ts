import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

export const MINIMUM_AGE = 18;

export interface AgeVerificationResult {
  passed: boolean;
  method: string;
}

/**
 * Swap this for a real third-party check (after the provider spike) by implementing
 * the interface and changing the provider used by AgeVerificationService.
 */
export interface AgeVerificationProvider {
  verify(input: { dob: Date }): Promise<AgeVerificationResult>;
}

export function isAtLeastAge(
  dob: Date,
  years: number,
  now = new Date(),
): boolean {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return dob <= cutoff;
}

/** Self-declared date of birth. Only the outcome is stored, never the DOB itself. */
@Injectable()
export class DobSelfDeclaredProvider implements AgeVerificationProvider {
  verify({ dob }: { dob: Date }): Promise<AgeVerificationResult> {
    return Promise.resolve({
      passed: isAtLeastAge(dob, MINIMUM_AGE),
      method: 'dob_self_declared',
    });
  }
}

@Injectable()
export class AgeVerificationService {
  constructor(private readonly provider: DobSelfDeclaredProvider) {}

  /** Throws unless the customer is old enough. Called only when the cart has age-restricted items. */
  async assertOldEnough(dobInput?: string): Promise<AgeVerificationResult> {
    if (!dobInput) {
      throw new BadRequestException(
        'Date of birth is required to buy age-restricted items',
      );
    }
    const dob = new Date(`${dobInput}T00:00:00.000Z`);
    if (
      Number.isNaN(dob.getTime()) ||
      dob > new Date() ||
      dob.getUTCFullYear() < 1900
    ) {
      throw new BadRequestException('Please enter a valid date of birth');
    }

    const result = await this.provider.verify({ dob });
    if (!result.passed) {
      throw new ForbiddenException(
        `You must be ${MINIMUM_AGE} or over to buy age-restricted items`,
      );
    }
    return result;
  }
}
