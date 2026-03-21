import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GateVerificationController } from './gate-verification.controller';
import { GateVerificationService } from './gate-verification.service';
import { GateLog } from './entities/gate-log.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { Person } from '../identity/entities/person.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([GateLog, Ticket, Person]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKey = config.get<string>('JWT_PRIVATE_KEY');
        const publicKey = config.get<string>('JWT_PUBLIC_KEY');
        if (!privateKey || !publicKey) {
          throw new Error(
            'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set for QR token signing.',
          );
        }
        return {
          privateKey,
          publicKey,
          signOptions: { algorithm: 'RS256' },
          verifyOptions: { algorithms: ['RS256'] },
        };
      },
    }),
    BlockchainModule,
  ],
  controllers: [GateVerificationController],
  providers: [GateVerificationService],
  exports: [GateVerificationService],
})
export class GateVerificationModule {}
