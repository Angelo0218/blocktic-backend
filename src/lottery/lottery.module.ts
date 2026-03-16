import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';
import { LotteryEntry } from './entities/lottery-entry.entity';
import { DrawResult } from './entities/draw-result.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LotteryEntry, DrawResult]),
    BlockchainModule,
    IdentityModule,
  ],
  controllers: [LotteryController],
  providers: [LotteryService],
  exports: [LotteryService],
})
export class LotteryModule {}
