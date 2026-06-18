import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CheckUsernameDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'Username must be 3-20 characters, letters, numbers, and underscores only',
  })
  username!: string;
}