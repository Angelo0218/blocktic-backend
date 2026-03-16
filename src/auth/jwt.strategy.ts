import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  /** 使用者 UUID（Person.id） */
  sub: string;
  /** 角色：user | admin */
  role: string;
  /** 簽發時間 */
  iat?: number;
  /** 過期時間 */
  exp?: number;
}

/**
 * Passport JWT Strategy — 從 Authorization: Bearer <token> 解析 JWT。
 *
 * JWT payload 格式：{ sub: 'uuid', role: 'user' | 'admin' }
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** validate 回傳值會被注入到 request.user */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
