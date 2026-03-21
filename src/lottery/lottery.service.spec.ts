import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LotteryService } from './lottery.service';
import { LotteryEntry, LotteryEntryStatus } from './entities/lottery-entry.entity';
import { DrawResult } from './entities/draw-result.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { IdentityService } from '../identity/identity.service';

describe('LotteryService', () => {
  let service: LotteryService;
  let entryRepo: any;
  let drawResultRepo: any;

  beforeEach(async () => {
    entryRepo = {
      create: jest.fn().mockImplementation((data) => ({ id: 'entry-1', ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    };

    drawResultRepo = {
      create: jest.fn().mockImplementation((data) => ({ id: 'draw-1', ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockBlockchain = {
      requestVrfRandomness: jest.fn().mockResolvedValue({
        vrfRequestId: 42n,
        randomWord: 123456789n,
      }),
      recordDrawResult: jest.fn().mockResolvedValue('0xDrawTx'),
    };

    const mockIdentity = {
      getKycStatus: jest.fn().mockResolvedValue({
        aaWalletAddress: '0xWinner',
      }),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: any) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(null),
          create: drawResultRepo.create,
          save: jest.fn().mockImplementation((entity, data) => Promise.resolve(data ?? entity)),
          update: jest.fn().mockResolvedValue(undefined),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotteryService,
        { provide: getRepositoryToken(LotteryEntry), useValue: entryRepo },
        { provide: getRepositoryToken(DrawResult), useValue: drawResultRepo },
        { provide: BlockchainService, useValue: mockBlockchain },
        { provide: IdentityService, useValue: mockIdentity },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<LotteryService>(LotteryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create a new lottery entry', async () => {
      const result = await service.register('event-1', 'user-1', {
        zoneId: 'zone-A',
        groupSize: 2,
      });
      expect(result.eventId).toBe('event-1');
      expect(result.userId).toBe('user-1');
      expect(result.status).toBe(LotteryEntryStatus.PENDING);
    });

    it('should reject duplicate registration', async () => {
      entryRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register('event-1', 'user-1', { zoneId: 'zone-A', groupSize: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('draw', () => {
    it('should throw when no entries exist', async () => {
      entryRepo.find.mockResolvedValue([]);
      await expect(service.draw('event-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when draw already executed', async () => {
      entryRepo.find.mockResolvedValue([{ id: 'e1' }]);
      drawResultRepo.findOne.mockResolvedValue({ id: 'existing-draw' });
      await expect(service.draw('event-1')).rejects.toThrow(ConflictException);
    });

    it('should execute draw and produce winners', async () => {
      const entries = [
        { id: 'e1', eventId: 'event-1', userId: 'u1', zoneId: 'A', groupSize: 1, status: LotteryEntryStatus.PENDING },
        { id: 'e2', eventId: 'event-1', userId: 'u2', zoneId: 'A', groupSize: 1, status: LotteryEntryStatus.PENDING },
        { id: 'e3', eventId: 'event-1', userId: 'u3', zoneId: 'A', groupSize: 1, status: LotteryEntryStatus.PENDING },
        { id: 'e4', eventId: 'event-1', userId: 'u4', zoneId: 'A', groupSize: 1, status: LotteryEntryStatus.PENDING },
      ];
      entryRepo.find.mockResolvedValue(entries);
      drawResultRepo.findOne
        .mockResolvedValueOnce(null) // alreadyDrawn check
        .mockResolvedValueOnce({ vrfRequestId: '42', randomSeed: '0x123', drawProofTxHash: '0xDrawTx', drawnAt: new Date() }); // buildDrawResultResponse

      const result = await service.draw('event-1');
      expect(result.eventId).toBe('event-1');

      // 至少有一個 winner 和一個 loser
      const winners = entries.filter((e) => e.status === LotteryEntryStatus.WON);
      const losers = entries.filter((e) => e.status === LotteryEntryStatus.LOST);
      expect(winners.length).toBeGreaterThan(0);
      expect(losers.length).toBeGreaterThan(0);
      // 50% rule: ceil(4 * 0.5) = 2 winners
      expect(winners.length).toBe(2);
    });
  });

  describe('getProof', () => {
    it('should throw when no draw result found', async () => {
      drawResultRepo.findOne.mockResolvedValue(null);
      await expect(service.getProof('event-1')).rejects.toThrow(NotFoundException);
    });
  });
});
