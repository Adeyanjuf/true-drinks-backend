import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, MinLength } from 'class-validator';

export class CompleteGoogleProfileDto {
  @ApiProperty({
    description:
      'Signed ticket from the `ticket` query param of the /auth/complete-profile redirect (valid 15 min). Email and name are taken from it.',
  })
  @IsString()
  @IsNotEmpty()
  ticket!: string;

  @ApiProperty({ example: 'john_123' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message:
      'Username must be 3-20 characters, letters, numbers and underscores only',
  })
  username!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
