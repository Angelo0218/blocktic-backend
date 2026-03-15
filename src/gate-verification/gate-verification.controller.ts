import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GateVerificationService } from './gate-verification.service';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { VerifyEntryDto, FallbackVerifyDto } from './dto/verify-entry.dto';

@ApiTags('Gate Verification')
@Controller('gate')
export class GateVerificationController {
  constructor(private readonly gateVerificationService: GateVerificationService) {}

  @Post('qr/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate dynamic QR code (JWT with ticketId + nonce + 60s expiry)' })
  @ApiResponse({ status: 200, description: 'QR token generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid ticket' })
  @ApiResponse({ status: 409, description: 'Ticket already used' })
  async generateQr(@Body() dto: GenerateQrDto) {
    return this.gateVerificationService.generateDynamicQr(dto.ticketId);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify entry by scanning QR code with optional face comparison' })
  @ApiResponse({ status: 200, description: 'Entry verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid/expired QR or face mismatch' })
  @ApiResponse({ status: 409, description: 'Replay detected or ticket already used' })
  async verifyEntry(@Body() dto: VerifyEntryDto) {
    return this.gateVerificationService.verifyEntry(
      dto.qrToken,
      dto.gateId,
      dto.staffId,
      dto.facePhoto,
    );
  }

  @Post('verify/fallback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fallback verification using government ID number' })
  @ApiResponse({ status: 200, description: 'Fallback verification succeeded' })
  @ApiResponse({ status: 400, description: 'No matching person or ticket found' })
  async fallbackVerify(@Body() dto: FallbackVerifyDto) {
    return this.gateVerificationService.fallbackVerify(
      dto.governmentIdNumber,
      dto.eventId,
      dto.gateId,
      dto.staffId,
    );
  }

  @Get('events/:eventId/stats')
  @ApiOperation({ summary: 'Get entry verification statistics for an event' })
  @ApiResponse({ status: 200, description: 'Entry statistics returned' })
  async getStats(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.gateVerificationService.getEntryStats(eventId);
  }
}
