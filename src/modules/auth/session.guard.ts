import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { AuthService, type Identity } from './auth.service';

export interface SessionRequest {
  headers: Record<string, unknown>;
  identity?: Identity;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    request.identity = await this.auth.authenticate(request.headers.authorization);
    return true;
  }
}

export const CurrentIdentity = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<SessionRequest>().identity);
