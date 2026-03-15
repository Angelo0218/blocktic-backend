import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GateVerificationController } from './gate-verification.controller';
import { GateVerificationService } from './gate-verification.service';
import { GateLog } from './entities/gate-log.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { Person } from '../identity/entities/person.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GateLog, Ticket, Person]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: config.get<string>('JWT_PRIVATE_KEY'),
        publicKey: config.get<string>('JWT_PUBLIC_KEY'),
        signOptions: { algorithm: 'RS256' },
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  controllers: [GateVerificationController],
  providers: [GateVerificationService],
  exports: [GateVerificationService],
})
export class GateVerificationModule {}
