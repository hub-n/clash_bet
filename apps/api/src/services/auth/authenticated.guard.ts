import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    // Logger.log('Session:', request.session);
    // Logger.log('Session ID:', request.sessionID);
    return request.isAuthenticated();
  }
}
