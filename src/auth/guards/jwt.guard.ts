import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@prisma/client';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser = User>(err: Error | null, user: User | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        'You must be logged in to access this resource',
      );
    }
    return user as TUser;
  }
}