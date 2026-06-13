import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // If a specific field is requested e.g @GetUser('email')
    // return just that field, otherwise return full user
    if (data) {
      return request.user[data];
    }
    return request.user;
  },
);