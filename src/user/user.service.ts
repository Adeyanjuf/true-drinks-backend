import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiResponse } from '../common/response/api-response';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}
  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: createUserDto.email },
          { username: createUserDto.username },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.email === createUserDto.email
          ? 'Email already taken'
          : 'Username already taken'
      );
    }

    const password_hashed = await bcrypt.hash(createUserDto.password, 10);
  
    const user = await this.prisma.user.create({ data: { ...createUserDto, password: password_hashed} });
    await this.authService.requestOtp({ email: user.email });
  
    return ApiResponse.success(
      { email: user.email },
      'Account created. Please check your email for a verification code.',
      201
    );
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
