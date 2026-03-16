import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 從 JWT payload 提取當前使用者資訊。
 *
 * 使用方式：
 *   @UseGuards(JwtAuthGuard)
 *   async someEndpoint(@CurrentUser() user: JwtPayload) { ... }
 *   async someEndpoint(@CurrentUser('sub') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
