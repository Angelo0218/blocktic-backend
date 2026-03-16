import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('Lottery')
@ApiBearerAuth()
@Controller('lottery/events')
export class LotteryController {
  constructor(private readonly lotteryService: LotteryService) {}

  @Post(':eventId/register')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register for event lottery' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Registration successful', type: LotteryEntry })
  @ApiResponse({ status: 409, description: 'User already registered' })
  async register(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: RegisterLotteryDto,
  ): Promise<LotteryEntry> {
    return this.lotteryService.register(eventId, userId, dto);
  }

  @Post(':eventId/draw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Trigger lottery draw (admin only)' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Draw executed', type: DrawResultResponseDto })
  @ApiResponse({ status: 404, description: 'No entries found' })
  @ApiResponse({ status: 409, description: 'Draw already executed' })
  async draw(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<DrawResultResponseDto> {
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
