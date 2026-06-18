import { IsEmail, IsString, IsNotEmpty, Matches } from "class-validator";

export class CompleteGoogleProfileDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'Username must be 3-20 characters, letters, numbers and underscores only',
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}