import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@CurrentUser() user: { id: string; role: string }) {
    return this.authService.login(user);
  }

  @Get('patient-by-code')
  async patientByCode(@Query('code') code: string) {
    const user = await this.authService.findPatientByCode(code);
    if (!user) throw new NotFoundException('Account code not found');
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      pinSet: user.pinHash !== null,
    };
  }

  // First-time PIN setup — no auth guard; only succeeds when pinHash is still null.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('set-pin')
  @HttpCode(HttpStatus.OK)
  setPin(@Body() body: { userId: string; pin: string }) {
    return this.authService.setPin(body.userId, body.pin);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('pin-login')
  @HttpCode(HttpStatus.OK)
  pinLogin(@Body() dto: PinLoginDto) {
    return this.authService.pinLogin(dto.userId, dto.pin);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { userId: string; refreshToken: string }) {
    return this.authService.refresh(body.userId, body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }
}
