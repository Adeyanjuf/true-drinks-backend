import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  // canActivate calls Passport's JWT strategy under the hood
  // if strategy throws, request is rejected
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  // handleRequest is called after canActivate
  // err — passport error
  // user — what validate() returned (our mentee)
  // if no user or error, we reject with 401
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException(
        'You must be logged in to access this resource'
      );
    }
    return user;
  }
}