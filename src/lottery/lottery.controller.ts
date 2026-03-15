import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LotteryService } from './lottery.service';
import { RegisterLotteryDto } from './dto/register-lottery.dto';
import {
  DrawResultResponseDto,
  DrawProofResponseDto,
} from './dto/draw-result.dto';
import { LotteryEntry } from './entities/lottery-entry.entity';

@ApiTags('Lottery')
@ApiBearerAuth()
@Controller('lottery/events')
export class LotteryController {
  constructor(private readonly lotteryService: LotteryService) {}

  @Post(':eventId/register')
  @ApiOperation({ summary: 'Register for event lottery' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Registration successful', type: LotteryEntry })
  @ApiResponse({ status: 409, description: 'User already registered' })
  async register(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: RegisterLotteryDto,
  ): Promise<LotteryEntry> {
    // TODO: Extract userId from JWT / auth guard
    const userId = '00000000-0000-0000-0000-000000000000';
    return this.lotteryService.register(eventId, userId, dto);
  }

  @Post(':eventId/draw')
  @ApiOperation({ summary: 'Trigger lottery draw (admin only)' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Draw executed', type: DrawResultResponseDto })
  @ApiResponse({ status: 404, description: 'No entries found' })
  @ApiResponse({ status: 409, description: 'Draw already executed' })
  async draw(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<DrawResultResponseDto> {
    // TODO: Add admin role guard
    return this.lotteryService.draw(eventId);
  }

  @Get(':eventId/results')
  @ApiOperation({ summary: 'Get lottery draw results' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Draw results', type: DrawResultResponseDto })
  async getResults(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<DrawResultResponseDto> {
    return this.lotteryService.getResults(eventId);
  }

  @Get(':eventId/proof')
  @ApiOperation({ summary: 'Get on-chain draw proof (Chainlink VRF)' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Draw proof', type: DrawProofResponseDto })
  @ApiResponse({ status: 404, description: 'No draw result found' })
  async getProof(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<DrawProofResponseDto> {
    return this.lotteryService.getProof(eventId);
  }
}
