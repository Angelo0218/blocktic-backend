import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TicketingService } from './ticketing.service';
import { PreauthDto } from './dto/preauth.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Ticketing')
@ApiBearerAuth()
@Controller('tickets')
export class TicketingController {
  constructor(private readonly ticketingService: TicketingService) {}

  @Post('events/:eventId/preauth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pre-authorize payment via ECPay (21-day hold)' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Payment pre-authorized' })
  async preauthorize(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: PreauthDto,
    @CurrentUser('sub') userId: string,
  ): Promise<{ ticket: TicketResponseDto; paymentFormData: Record<string, string> }> {
    // 使用 JWT subject 作為 userId，忽略 body 中的 userId 防止偽造
    dto.userId = userId;
    return this.ticketingService.preauthorize(eventId, dto);
  }

  @Post(':ticketId/capture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Capture pre-authorized payment after winning lottery (admin)' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  async capture(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketResponseDto> {
    return this.ticketingService.capturePayment(ticketId);
  }

  @Post(':ticketId/mint')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mint SBT ticket on Polygon after payment capture (admin)' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  async mint(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketResponseDto> {
    return this.ticketingService.mintTicket(ticketId);
  }

  @Post(':ticketId/refund')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Refund ticket and return seat to waitlist pool' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  async refund(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<TicketResponseDto> {
    return this.ticketingService.refundTicket(ticketId, userId);
  }

  // ECPay callback 不需要 JWT（綠界伺服器回呼，用 CheckMacValue 驗證）
  @Post('ecpay/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'ECPay server callback (webhook)',
    description: '綠界付款結果通知端點，回傳 "1|OK" 表示收到。以 CheckMacValue 驗證。',
  })
  @ApiResponse({ status: 200, description: '1|OK or error message' })
  async ecpayCallback(
    @Body() body: Record<string, string>,
  ): Promise<string> {
    return this.ticketingService.handleEcpayCallback(body);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all tickets for the current user' })
  @ApiResponse({ status: 200, type: [TicketResponseDto] })
  async findMyTickets(
    @CurrentUser('sub') userId: string,
  ): Promise<TicketResponseDto[]> {
    return this.ticketingService.findByUser(userId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all tickets for a specific user (admin only)' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: [TicketResponseDto] })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TicketResponseDto[]> {
    return this.ticketingService.findByUser(userId);
  }

  @Get(':ticketId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get ticket details by ID' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async findById(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketResponseDto> {
    return this.ticketingService.findById(ticketId);
  }
}
