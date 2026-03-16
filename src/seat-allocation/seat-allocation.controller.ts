import {
  Controller,
  Post,
  Get,
  Delete,
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
import { SeatAllocationService } from './seat-allocation.service';
import { AllocateSeatsDto } from './dto/allocate-seats.dto';
import { AllocationResultDto, SeatMapResponseDto } from './dto/seat-map.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('Seat Allocation')
@ApiBearerAuth()
@Controller('seats')
export class SeatAllocationController {
  constructor(private readonly seatAllocationService: SeatAllocationService) {}

  @Post('events/:eventId/allocate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Allocate consecutive seats for a lottery winner (admin)',
    description:
      'Automatically finds and locks consecutive seats in the requested zone. ' +
      'Uses PostgreSQL FOR UPDATE SKIP LOCKED to safely handle concurrent requests.',
  })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, type: AllocationResultDto })
  @ApiResponse({ status: 404, description: 'Event or zone not found' })
  @ApiResponse({ status: 409, description: 'Not enough consecutive seats available' })
  async allocateSeats(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: AllocateSeatsDto,
  ): Promise<AllocationResultDto> {
    return this.seatAllocationService.allocateSeats(eventId, dto);
  }

  @Get('events/:eventId/map')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get seat map with availability for an event',
    description:
      'Returns seat counts grouped by zone and row, including availability totals.',
  })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: SeatMapResponseDto })
  @ApiResponse({ status: 404, description: 'No seats found for event' })
  async getSeatMap(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<SeatMapResponseDto> {
    return this.seatAllocationService.getSeatMap(eventId);
  }

  @Delete(':seatId/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Release an allocated seat (admin, e.g. for refund)',
    description: 'Sets the seat status back to available and clears the ticket association.',
  })
  @ApiParam({ name: 'seatId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Seat released successfully' })
  @ApiResponse({ status: 404, description: 'Seat not found' })
  @ApiResponse({ status: 409, description: 'Seat cannot be released (already available or used)' })
  async releaseSeat(
    @Param('seatId', ParseUUIDPipe) seatId: string,
  ): Promise<void> {
    return this.seatAllocationService.releaseSeat(seatId);
  }
}
