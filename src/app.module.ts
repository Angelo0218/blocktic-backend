import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { IdentityModule } from './identity/identity.module';
import { LotteryModule } from './lottery/lottery.module';
import { SeatAllocationModule } from './seat-allocation/seat-allocation.module';
import { TicketingModule } from './ticketing/ticketing.module';
import { GateVerificationModule } from './gate-verification/gate-verification.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'blocktic'),
        password: config.get('DB_PASSWORD', 'blocktic'),
        database: config.get('DB_DATABASE', 'blocktic'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV', 'development') !== 'production',
        migrations: ['dist/migrations/*.js'],
        migrationsRun: config.get('NODE_ENV', 'development') === 'production',
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 60 秒
        limit: 60, // 每 IP 最多 60 次
      },
    ]),
    AuthModule,
    IdentityModule,
    LotteryModule,
    SeatAllocationModule,
    TicketingModule,
    GateVerificationModule,
    BlockchainModule,
    AuditModule,
    EventsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
