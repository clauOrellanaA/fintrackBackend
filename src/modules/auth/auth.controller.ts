import { BadRequestException, Body, Controller, Delete, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService, type Identity } from './auth.service';
import { CurrentIdentity, SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(@Body() body: unknown) {
    const data = body as Record<string, unknown> | null;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 2
      || typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
      || typeof data.password !== 'string' || data.password.length < 1 || data.password.length > 1024) {
      throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Se requieren email y password validos.' } });
    }
    return this.auth.login(data.email.toLowerCase(), data.password);
  }

  @Delete('session')
  @UseGuards(SessionGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@CurrentIdentity() identity: Identity) { await this.auth.logout(identity); }
}
