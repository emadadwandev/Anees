import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { Config } from '../config/config.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Config>,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string, ipAddress?: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      await this._auditFailedLogin(null, email, ipAddress);
      return null;
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      await this._auditFailedLogin(user.id, email, ipAddress);
      return null;
    }
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  private async _auditFailedLogin(userId: string | null, email: string, ipAddress?: string) {
    if (!userId) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'auth.login_failed',
          resourceType: 'user',
          resourceId: userId,
          ipAddress: ipAddress ?? null,
        },
      });
    } catch {
      // Non-fatal — never let audit logging break auth
    }
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const { password: _pw, ...rest } = dto;
    const user = await this.usersService.create({ ...rest, passwordHash });
    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: { id: user.id, role: user.role } };
  }

  async pinLogin(userId: string, pin: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid PIN');
    if (!user.pinHash) throw new UnauthorizedException('PIN not set — use set-pin first');
    const match = await bcrypt.compare(pin, user.pinHash);
    if (!match) throw new UnauthorizedException('Invalid PIN');
    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: { id: user.id, role: user.role } };
  }

  async setPin(userId: string, pin: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.pinHash) throw new BadRequestException('PIN already set');
    const hash = await bcrypt.hash(pin, 10);
    await this.usersService.setPinHash(userId, hash);
    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: { id: user.id, role: user.role } };
  }

  async login(user: { id: string; role: string }) {
    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: { id: user.id, role: user.role } };
  }

  async refresh(userId: string, refreshToken: string) {
    const stored = await this.usersService.getRefreshToken(userId);
    if (!stored) throw new UnauthorizedException('Session expired');
    const valid = await bcrypt.compare(refreshToken, stored);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user.id, user.role);
  }

  async logout(userId: string) {
    await this.usersService.deleteRefreshToken(userId);
  }

  findPatientByCode(code: string) {
    return this.usersService.findByAccountCode(code);
  }

  private async issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_TTL'),
    });
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.storeRefreshToken(userId, hash, this.config.get('JWT_REFRESH_TTL'));
    return { accessToken, refreshToken };
  }
}
