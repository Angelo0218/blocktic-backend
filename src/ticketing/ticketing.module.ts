import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketingController } from './ticketing.controller';
import { TicketingService } from './ticketing.service';
import { Ticket } from './entities/ticket.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { SeatAllocationModule } from '../seat-allocation/seat-allocation.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Ticket]),
    BlockchainModule,
    SeatAllocationModule,
    IdentityModule,
  ],
  controllers: [TicketingController],
  providers: [TicketingService],
  exports: [TicketingService],
})
export class TicketingModule {}
