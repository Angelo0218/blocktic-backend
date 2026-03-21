import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IdentityService } from './identity.service';
import { Person, KycStatus } from './entities/person.entity';
import { User } from '../auth/entities/user.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      FaceDetails: [{
        Confidence: 99.5,
        Quality: { Sharpness: 80, Brightness: 70 },
        EyesOpen: { Value: true, Confidence: 99 },
      }],
    }),
  })),
  DetectFacesCommand: jest.fn(),
}));

// Mock fetch for CompreFace
global.fetch = jest.fn();

describe('IdentityService', () => {
  let service: IdentityService;
  let personRepo: any;

  const mockPerson: Partial<Person> = {
    id: 'person-uuid',
    kycStatus: KycStatus.PENDING,
    personIdHash: null,
    faceEmbeddingRef: null,
    aaWalletAddress: null,
    kycAttestationTxHash: null,
    consentRecordedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    personRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...mockPerson, ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const mockBlockchain = {
      createAAWallet: jest.fn().mockResolvedValue({
        walletAddress: '0xWallet',
        userId: 'person-uuid',
        isDeployed: false,
      }),
      mintKycSbt: jest.fn().mockResolvedValue('0xTxHash'),
    };

    const configMap: Record<string, string | number> = {
      AWS_REGION: 'ap-northeast-1',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      COMPREFACE_URL: 'http://localhost:8000',
      COMPREFACE_VERIFY_API_KEY: 'verify-key',
      COMPREFACE_RECOGNIZE_API_KEY: 'recognize-key',
      FACE_MATCH_THRESHOLD: 0.85,
    };
    const mockConfig = {
      getOrThrow: jest.fn((key: string) => configMap[key]),
      get: jest.fn((key: string, defaultVal?: any) => configMap[key] ?? defaultVal),
    };

    const mockUserRepo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb: any) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === Person) return personRepo;
            if (entity === User) return mockUserRepo;
            return {};
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfig },
        { provide: BlockchainService, useValue: mockBlockchain },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject KYC without consent', async () => {
    await expect(
      service.submitKyc({
        idCardImage: 'base64data',
        selfieImage: 'base64data',
        consent: false,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject duplicate ID documents', async () => {
    // 無 userId → 不走第一次 findOne，直接 create+save
    // 第一次 findOne 是 hash check → 回傳已存在的其他 person
    personRepo.findOne
      .mockResolvedValueOnce({ id: 'other-person', personIdHash: 'somehash' });

    const result = await service.submitKyc({
      idCardImage: 'base64data',
      selfieImage: 'base64data',
      consent: true,
    });

    expect(result.kycStatus).toBe(KycStatus.REJECTED);
    expect(result.message).toContain('duplicate');
  });

  it('getKycStatus should throw when user not found', async () => {
    personRepo.findOne.mockResolvedValue(null);
    await expect(service.getKycStatus('nonexistent')).rejects.toThrow();
  });

  it('deleteUserData should remove person and return deleted=true', async () => {
    personRepo.findOne.mockResolvedValue({ ...mockPerson, faceEmbeddingRef: null });
    const result = await service.deleteUserData('person-uuid');
    expect(result.deleted).toBe(true);
    expect(personRepo.remove).toHaveBeenCalled();
  });
});
