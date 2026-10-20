import { BadRequestException, Body, Controller, Delete, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService, type Identity } from './auth.service';
import { CurrentIdentity, SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  register(@Body() body: unknown) {
    const data = body as Record<string, unknown> | null;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 3
      || typeof data.email !== 'string' || data.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
      || typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 1024
      || typeof data.displayName !== 'string' || !data.displayName.trim() || data.displayName.trim().length > 80) {
      throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'Se requieren email, nombre y una contrasena de 12 a 1024 caracteres.' } });
    }
    return this.auth.register(data.email.trim().toLowerCase(), data.password, data.displayName.trim());
  }

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

  @Post('password')
  @UseGuards(SessionGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async changePassword(@CurrentIdentity() identity: Identity, @Body() body: unknown) {
    const data = body as Record<string, unknown> | null;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 2
      || typeof data.currentPassword !== 'string' || data.currentPassword.length < 1 || data.currentPassword.length > 1024
      || typeof data.newPassword !== 'string' || data.newPassword.length < 12 || data.newPassword.length > 1024) {
      throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'La nueva contrasena debe tener entre 12 y 1024 caracteres.' } });
    }
    await this.auth.changePassword(identity.userId, data.currentPassword, data.newPassword);
  }
}
