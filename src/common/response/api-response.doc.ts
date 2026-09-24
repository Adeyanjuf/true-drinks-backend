import { applyDecorators } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

// Documents the { statusCode, message, data } envelope every endpoint returns.
export const ApiEnvelope = (
  description: string,
  data: unknown = null,
  message = 'Success',
) =>
  ApiOkResponse({
    description,
    schema: { example: { statusCode: 200, message, data } },
  });

const errorExample = (statusCode: number, message: string, type: string) => ({
  schema: { example: { statusCode, message, type } },
});

export const ApiUnauthorized = () =>
  ApiUnauthorizedResponse({
    description: 'Missing, invalid or expired access token',
    ...errorExample(
      401,
      'You must be logged in to access this resource',
      'UnauthorizedException',
    ),
  });

export const ApiAdminOnly = () =>
  applyDecorators(
    ApiUnauthorized(),
    ApiForbiddenResponse({
      description: 'Authenticated but not an ADMIN',
      ...errorExample(
        403,
        'You do not have permission to access this resource',
        'ForbiddenException',
      ),
    }),
  );

export const ApiConflict = (message: string) =>
  ApiConflictResponse({
    description: message,
    ...errorExample(409, message, 'ConflictException'),
  });
