import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';
import { LotteryEntry } from './entities/lottery-entry.entity';
import { DrawResult } from './entities/draw-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LotteryEntry, DrawResult])],
  controllers: [LotteryController],
  providers: [LotteryService],
  exports: [LotteryService],
})
export class LotteryModule {}
