import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty({
    description: 'ERC-4337 Account Abstraction wallet address (counterfactual, may not be deployed yet)',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Platform user ID associated with this wallet',
    example: 'usr_abc123',
  })
  userId: string;

  @ApiProperty({
    description: 'Whether the wallet smart contract has been deployed on-chain (lazy deployment on first UserOp)',
    example: false,
  })
  isDeployed: boolean;
}

export class CreateWalletDto {
  @ApiProperty({
    description: 'Platform user ID to create a wallet for',
    example: 'usr_abc123',
  })
  userId: string;
}
