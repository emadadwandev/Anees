import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

interface CreateUserInput {
  email: string;
  passwordHash: string;
  pinHash?: string;
  accountCode?: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  language?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByAccountCode(code: string) {
    return this.prisma.user.findUnique({ where: { accountCode: code } });
  }

  async setPinHash(id: string, hash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { pinHash: hash } });
  }

  create(input: CreateUserInput) {
    return this.prisma.user.create({ data: input });
  }

  updateProfile(id: string, dto: { firstName?: string; lastName?: string; phone?: string; language?: string }) {
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  updateAvatar(id: string, avatarUrl: string) {
    return this.prisma.user.update({ where: { id }, data: { avatarUrl } });
  }

  async storeRefreshToken(userId: string, hash: string, ttl: number) {
    await this.redis.set(`refresh:${userId}`, hash, 'EX', ttl);
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return this.redis.get(`refresh:${userId}`);
  }

  async deleteRefreshToken(userId: string) {
    await this.redis.del(`refresh:${userId}`);
  }
}
