import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService Google tickets', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const user = {
    id: 'u1',
    email: 'a@b.com',
    name: 'A',
    role: 'CUSTOMER',
    isVerified: true,
  };
  const prisma: any = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn() },
    order: { updateMany: jest.fn() },
  };
  let service: AuthService;
  const qs = (url: string, key: string) => new URL(url).searchParams.get(key)!;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'http://fe.test';
    service = new AuthService(prisma, jwt, {} as any, {} as any);
  });

  it('existing user: redirects with a code, never an access token', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    const url = await service.googleLogin({ email: user.email, name: 'A' });
    expect(url).toContain('/auth/callback?code=');
    expect(url).not.toContain('token=');
  });

  it('exchange returns tokens for a valid code', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    const url = await service.googleLogin({ email: user.email, name: 'A' });
    const res: any = await service.exchangeGoogleCode(qs(url, 'code'));
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(JSON.stringify(res)).toContain('refreshToken');
  });

  it('exchange rejects a signup ticket, garbage and tampered codes', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const url = await service.googleLogin({ email: 'n@b.com', name: 'N' });
    const ticket = qs(url, 'ticket');
    await expect(service.exchangeGoogleCode(ticket)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.exchangeGoogleCode('junk')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.exchangeGoogleCode(ticket.slice(0, -2) + 'xx'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('exchange rejects an expired code', async () => {
    const expired = jwt.sign(
      { sub: 'u1', purpose: 'google-login' },
      { expiresIn: -10 },
    );
    await expect(service.exchangeGoogleCode(expired)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('completeGoogleProfile takes email/name from the ticket', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...user, email: 'n@b.com' });
    const url = await service.googleLogin({ email: 'n@b.com', name: 'N' });
    await service.completeGoogleProfile({
      ticket: qs(url, 'ticket'),
      username: 'new_user',
      password: 'password123',
    });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      email: 'n@b.com',
      name: 'N',
    });
  });

  it('completeGoogleProfile rejects a forged ticket', async () => {
    await expect(
      service.completeGoogleProfile({
        ticket: 'forged',
        username: 'x_user',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
