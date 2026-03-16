import { SetMetadata } from '@nestjs/common';

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

export const ROLES_KEY = 'roles';

/**
 * 標記端點所需的角色。搭配 RolesGuard 使用。
 *
 * 使用方式：
 *   @Roles(Role.ADMIN)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   async adminOnly() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
