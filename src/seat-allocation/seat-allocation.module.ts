import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seat } from './entities/seat.entity';
import { Venue } from './entities/venue.entity';
import { SeatAllocationService } from './seat-allocation.service';
import { SeatAllocationController } from './seat-allocation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Seat, Venue])],
  controllers: [SeatAllocationController],
  providers: [SeatAllocationService],
  exports: [SeatAllocationService],
})
export class SeatAllocationModule {}
