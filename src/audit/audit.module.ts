import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { GateLog } from '../gate-verification/entities/gate-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, GateLog]),
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: 'audit' }),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
