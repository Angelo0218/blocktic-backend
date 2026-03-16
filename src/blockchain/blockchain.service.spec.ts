import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';

// Mock ethers 模組
jest.mock('ethers', () => {
  const mockContract = {
    mint: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: '0xabc123' }) }),
    burn: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: '0xdef456' }) }),
    recordDraw: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: '0x789' }) }),
    balanceOf: jest.fn().mockResolvedValue(1n),
    getFunction: jest.fn().mockReturnValue(
      jest.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678'),
    ),
    requestRandomWords: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: '0xvrf' }) }),
    lastRequestId: jest.fn().mockResolvedValue(42n),
    getRequestResult: jest.fn().mockResolvedValue([true, 99999n]),
  };

  return {
    JsonRpcProvider: jest.fn(),
    Wallet: jest.fn().mockImplementation(() => ({ address: '0xDeployer' })),
    Contract: jest.fn().mockImplementation(() => mockContract),
    keccak256: jest.fn().mockReturnValue('0x' + 'a'.repeat(64)),
    solidityPacked: jest.fn().mockReturnValue('0x1234'),
  };
});

describe('BlockchainService', () => {
  let service: BlockchainService;

  const mockConfig = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        POLYGON_RPC_URL: 'https://rpc-amoy.polygon.technology',
        POLYGON_PRIVATE_KEY: '0x' + 'a'.repeat(64),
        SBT_CONTRACT_ADDRESS: '0x' + '1'.repeat(40),
        WALLET_FACTORY_ADDRESS: '0x' + '2'.repeat(40),
        VRF_COORDINATOR_ADDRESS: '0x' + '3'.repeat(40),
      };
      return map[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('createAAWallet should return wallet address and userId', async () => {
    const result = await service.createAAWallet('user-123');
    expect(result.walletAddress).toBeDefined();
    expect(result.userId).toBe('user-123');
    expect(result.isDeployed).toBe(false);
  });

  it('mintKycSbt should return tx hash', async () => {
    const txHash = await service.mintKycSbt('0xWallet', 1);
    expect(txHash).toBe('0xabc123');
  });

  it('mintTicketSbt should return tx hash', async () => {
    const txHash = await service.mintTicketSbt('0xWallet', 1000);
    expect(txHash).toBe('0xabc123');
  });

  it('burnTicketSbt should return tx hash', async () => {
    const txHash = await service.burnTicketSbt('0xWallet', 1000);
    expect(txHash).toBe('0xdef456');
  });

  it('verifySbtOwnership should return true when balance > 0', async () => {
    const owns = await service.verifySbtOwnership('0xWallet', 1);
    expect(owns).toBe(true);
  });

  it('recordDrawResult should return tx hash', async () => {
    const txHash = await service.recordDrawResult(1, 1, 42n, 99999n, ['0xWinner']);
    expect(txHash).toBe('0x789');
  });
});
