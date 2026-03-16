import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { TicketingService } from './ticketing.service';
import { PreauthDto } from './dto/preauth.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';

@ApiTags('Ticketing')
@Controller('tickets')
export class TicketingController {
  constructor(private readonly ticketingService: TicketingService) {}

  // POST /tickets/events/:eventId/preauth
  @Post('events/:eventId/preauth')
  @ApiOperation({
    summary: 'Pre-authorize payment via ECPay (21-day hold)',
  })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Payment pre-authorized' })
  async preauthorize(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: PreauthDto,
  ): Promise<{ ticket: TicketResponseDto; paymentFormData: Record<string, string> }> {
    return this.ticketingService.preauthorize(eventId, dto);
  }

  // POST /tickets/:ticketId/capture
  @Post(':ticketId/capture')
  @ApiOperation({
    summary: 'Capture pre-authorized payment after winning lottery',
  })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  async capture(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketResponseDto> {
    return this.ticketingService.capturePayment(ticketId);
  }

  // POST /tickets/:ticketId/mint
  @Post(':ticketId/mint')
  @ApiOperation({
    summary: 'Mint SBT (Soulbound Token) ticket on Polygon after payment capture',
  })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  async mint(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketResponseDto> {
    return this.ticketingService.mintTicket(ticketId);
  }

  // POST /tickets/:ticketId/refund
  @Post(':ticketId/refund')
  @ApiOperation({
    summary: 'Refund ticket and return seat to waitlist pool',
  })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  async refund(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketResponseDto> {
    return this.ticketingService.refundTicket(ticketId);
  }

  // POST /tickets/ecpay/callback（綠界伺服器回呼）
  @Post('ecpay/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'ECPay server callback (webhook)',
    description: '綠界付款結果通知端點，回傳 "1|OK" 表示收到。',
  })
  @ApiResponse({ status: 200, description: '1|OK or error message' })
  async ecpayCallback(
    @Body() body: Record<string, string>,
  ): Promise<string> {
    return this.ticketingService.handleEcpayCallback(body);
  }

  // GET /tickets/user/:userId
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all tickets for a user' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: [TicketResponseDto] })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TicketResponseDto[]> {
    return this.ticketingService.findByUser(userId);
  }

  // GET /tickets/:ticketId
  @Get(':ticketId')
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
