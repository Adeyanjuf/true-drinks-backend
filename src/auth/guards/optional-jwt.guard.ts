import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// For routes open to guests AND logged-in users: no Authorization header means
// req.user is null; a header that is present but invalid is still rejected.
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string> }>();
    if (err) throw err;
    if (!user) {
      if (req.headers.authorization) {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      return null as TUser;
    }
    return user;
  }
}
