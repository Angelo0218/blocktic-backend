import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 認證 Guard — 驗證 Bearer token 並將 payload 注入 request.user。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
