import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { Person } from './entities/person.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Person]),
    BlockchainModule,
  ],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
