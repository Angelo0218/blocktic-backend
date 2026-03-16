# BlockTic

[![NestJS](https://img.shields.io/badge/NestJS-11-red?style=flat-square&logo=nestjs)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Polygon](https://img.shields.io/badge/Polygon-PoS-9C3DCC?style=flat-square&logo=polygon)](https://polygon.technology)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

## Overview

BlockTic is an **AI-powered anti-scalper ticketing system** that leverages cutting-edge technology to create a completely fair, transparent, and user-friendly ticketing experience. By combining face recognition KYC, Chainlink VRF fair lottery, Soulbound Tokens (SBT), and ERC-4337 account abstraction, BlockTic eliminates ticket scalping while keeping the system accessible to everyone—no crypto wallet, no gas fees required.

## Key Features

### 🛡️ 4-Layer Identity Defense
- **ID Uniqueness Check**: Prevent duplicate registrations via national ID verification
- **AWS Rekognition Liveness Detection**: Advanced anti-spoofing with live face detection
- **CompreFace 1:1 Face Matching**: High-accuracy facial recognition for identity verification
- **1:N Face Deduplication**: Cross-user face matching to prevent identity fraud at scale

### 🎲 Chainlink VRF Fair Lottery
- **Verifiable Random Draw**: Cryptographically fair lottery on Polygon blockchain
- **Transparent Selection**: All users can verify the draw process
- **Fraud-Proof**: Chainlink VRF v2.5 ensures randomness cannot be manipulated

### 🎫 SBT Soulbound Tickets
- **Non-Transferable by Design**: ERC-1155 smart contract with transfer override
- **Anti-Scalping**: Tickets cannot be resold on secondary markets
- **Owner-Controlled**: Platform retains ticket management capabilities
- **Audit Trail**: Complete transaction history on blockchain

### 💳 ERC-4337 Account Abstraction
- **Zero Wallet Requirement**: Users need no cryptocurrency wallet
- **Platform Paymaster**: All gas fees covered by the platform
- **Ultra-Low Cost**: < NT$0.05 per user lifetime cost
- **Seamless UX**: Traditional payment flow without blockchain friction

### 🔐 Dynamic QR Entry
- **60-Second JWT Tokens**: Time-limited QR codes prevent code reuse
- **Gate Face Verification**: Real-time facial recognition at entry
- **Instant Access**: Fast entry without manual document checks
- **Fallback Mode**: Biometric override for accessibility

### ⚡ AI Lightweight Design
- **Consumer GPU Compatible**: CompreFace runs on NVIDIA RTX 3080 (~3GB VRAM)
- **Cost-Effective**: Total AI cost < NT$5 per ticket
- **On-Premise Option**: Keep facial data on your infrastructure
- **Hybrid Cloud**: Optional cloud AI integration for scale

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BlockTic Backend                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Identity/   │  │   Lottery    │  │     Seat     │    │
│  │     KYC      │  │   Module     │  │ Allocation   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Ticketing   │  │     Gate     │  │  Blockchain  │    │
│  │   Module     │  │  Verification│  │   Module     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           Audit & Logging Module                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 15  │  Redis 7  │  CompreFace  │  Polygon   │
└─────────────────────────────────────────────────────────────┘
```

### Core NestJS Modules

1. **Identity/KYC Module**: Face recognition, liveness detection, identity verification
2. **Lottery Module**: Chainlink VRF integration, fair draw management
3. **Seat Allocation Module**: Dynamic seat mapping and availability management
4. **Ticketing Module**: Ticket lifecycle management, SBT minting, refunds
5. **Gate Verification Module**: QR code generation, face verification, entry control
6. **Blockchain Module**: Smart contract interaction, account abstraction, transaction handling
7. **Audit Module**: Comprehensive logging, compliance tracking, event summaries

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22 + NestJS 11 |
| **Language** | TypeScript 5.0 |
| **Database** | PostgreSQL 15 + Redis 7 |
| **Job Queue** | BullMQ |
| **Local AI** | CompreFace (ArcFace-r100) + EasyOCR |
| **Cloud AI** | Google Gemini 2.5 Flash Vision + AWS Rekognition |
| **Blockchain** | Polygon PoS Chain |
| **Randomness** | Chainlink VRF v2.5 |
| **Token Standard** | ERC-1155 (SBT) + ERC-4337 |
| **Payment Gateway** | ECPay (Pre-authorization Mode) |

## Hardware Requirements

### Minimum Specifications
- **CPU**: 8-core processor (Intel Xeon / AMD EPYC equivalent)
- **Memory**: 32GB RAM
- **Storage**: 50GB SSD (for OS, app, and cache)
- **GPU**: NVIDIA RTX 3080 12GB VRAM (for CompreFace AI model)
- **Network**: 100Mbps minimum, stable internet connection

### Recommended Specifications
- **CPU**: 16-core processor
- **Memory**: 64GB RAM
- **Storage**: 200GB NVMe SSD
- **GPU**: NVIDIA RTX A5000 24GB VRAM (for higher throughput)
- **Network**: 1Gbps gigabit connection

## Quick Start

### Prerequisites
- Node.js 22+ and npm/yarn
- PostgreSQL 15+
- Redis 7+
- NVIDIA GPU with CUDA support (for on-premise AI)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/blocktic-backend.git
cd blocktic-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure environment variables
# Update .env with your database, Redis, Chainlink, and API keys
nano .env

# Run database migrations
npm run typeorm migration:run

# Start the application
npm run start

# For development with hot reload
npm run start:dev
```

### Environment Configuration

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/blocktic
REDIS_URL=redis://localhost:6379

# AWS Rekognition
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# CompreFace
COMPRFACE_API_URL=http://localhost:3000/api
COMPRFACE_API_KEY=your_key

# Google Gemini
GOOGLE_API_KEY=your_key

# Blockchain
POLYGON_RPC_URL=https://polygon-rpc.com
CHAIN_ID=137
CONTRACT_ADDRESS=0x...
CHAINLINK_VRF_COORDINATOR=0x...
CHAINLINK_SUBSCRIPTION_ID=...

# ECPay
ECPAY_MERCHANT_ID=your_id
ECPAY_HASH_KEY=your_key

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRATION=3600
```

### Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Check database connection
npm run typeorm query "SELECT NOW()"
```

## API Reference

### Identity/KYC Endpoints

#### Register User Identity
```http
POST /identity/kyc
Content-Type: multipart/form-data

{
  "userId": "user123",
  "idCard": <binary_image>,
  "facePhoto": <binary_image>,
  "email": "user@example.com"
}

Response: 201 Created
{
  "kyc_id": "kyc_xyz",
  "status": "PENDING",
  "created_at": "2026-03-15T10:00:00Z"
}
```

#### Check KYC Status
```http
GET /identity/kyc/status/:userId

Response: 200 OK
{
  "status": "VERIFIED",
  "verified_at": "2026-03-15T10:30:00Z",
  "face_id": "face_abc123"
}
```

#### Delete Identity Data (GDPR)
```http
DELETE /identity/:userId

Response: 204 No Content
```

### Lottery Endpoints

#### Register for Lottery
```http
POST /lottery/events/:eventId/register
Content-Type: application/json

{
  "userId": "user123"
}

Response: 201 Created
{
  "registration_id": "reg_xyz",
  "event_id": "event123",
  "registered_at": "2026-03-15T10:00:00Z"
}
```

#### Trigger Lottery Draw
```http
POST /lottery/events/:eventId/draw

Response: 202 Accepted
{
  "draw_id": "draw_abc123",
  "status": "PENDING",
  "vrf_request_id": "0x...",
  "expected_completion": "2026-03-15T10:05:00Z"
}
```

#### Get Lottery Results
```http
GET /lottery/events/:eventId/results

Response: 200 OK
{
  "event_id": "event123",
  "total_participants": 5000,
  "winners_count": 100,
  "winners": [
    {
      "user_id": "user456",
      "position": 1,
      "ticket_id": "ticket_xyz"
    }
  ]
}
```

#### Get VRF Proof
```http
GET /lottery/events/:eventId/proof

Response: 200 OK
{
  "vrf_request_id": "0x...",
  "vrf_response": "0x...",
  "proof_url": "https://polygonscan.com/tx/0x..."
}
```

### Seat Allocation Endpoints

#### Allocate Seats
```http
POST /seats/events/:eventId/allocate
Content-Type: application/json

{
  "layout_json": { ... },
  "zone_configs": [ ... ]
}

Response: 201 Created
{
  "allocation_id": "alloc_xyz",
  "total_seats": 5000,
  "available_seats": 5000
}
```

#### Get Seat Map
```http
GET /seats/events/:eventId/map

Response: 200 OK
{
  "event_id": "event123",
  "layout": { ... },
  "seat_status": [
    {
      "seat_id": "A-001",
      "status": "AVAILABLE",
      "zone": "VIP"
    }
  ]
}
```

### Ticketing Endpoints

#### Create Pre-Authorization
```http
POST /tickets/events/:eventId/preauth
Content-Type: application/json

{
  "user_id": "user123",
  "amount": 2990,
  "ticket_quantity": 1
}

Response: 201 Created
{
  "preauth_id": "preauth_xyz",
  "merchant_trade_no": "...",
  "payment_url": "https://payment.ecpay.com.tw/..."
}
```

#### Capture Payment
```http
POST /tickets/:ticketId/capture
Content-Type: application/json

{
  "transaction_id": "txn_xyz"
}

Response: 200 OK
{
  "ticket_id": "ticket_abc",
  "status": "PAID",
  "amount": 2990
}
```

#### Mint SBT Ticket
```http
POST /tickets/:ticketId/mint
Content-Type: application/json

{
  "wallet_address": "0x..."
}

Response: 200 OK
{
  "ticket_id": "ticket_abc",
  "token_id": "123456",
  "transaction_hash": "0x...",
  "block_number": 12345678
}
```

#### Process Refund
```http
POST /tickets/:ticketId/refund
Content-Type: application/json

{
  "reason": "USER_REQUEST"
}

Response: 200 OK
{
  "ticket_id": "ticket_abc",
  "refund_amount": 2990,
  "status": "REFUNDED",
  "refund_txn_id": "refund_xyz"
}
```

### Gate Verification Endpoints

#### Generate Entry QR Code
```http
POST /gate/qr/generate
Content-Type: application/json

{
  "ticket_id": "ticket_abc",
  "user_id": "user123"
}

Response: 200 OK
{
  "qr_code": "data:image/png;base64,...",
  "jwt_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 60
}
```

#### Verify Entry
```http
POST /gate/verify
Content-Type: multipart/form-data

{
  "jwt_token": "eyJhbGciOiJIUzI1NiIs...",
  "face_photo": <binary_image>
}

Response: 200 OK
{
  "ticket_id": "ticket_abc",
  "user_id": "user123",
  "entry_granted": true,
  "entered_at": "2026-03-15T19:00:00Z"
}
```

#### Fallback Verification (No Face)
```http
POST /gate/verify/fallback
Content-Type: application/json

{
  "ticket_id": "ticket_abc",
  "staff_override_code": "STAFF_KEY_123"
}

Response: 200 OK
{
  "ticket_id": "ticket_abc",
  "entry_granted": true,
  "override_method": "STAFF"
}
```

### Audit Endpoints

#### Get Audit Logs
```http
GET /audit/logs?page=1&limit=100&filters=...

Response: 200 OK
{
  "total": 50000,
  "page": 1,
  "limit": 100,
  "logs": [
    {
      "timestamp": "2026-03-15T10:00:00Z",
      "action": "KYC_VERIFIED",
      "user_id": "user123",
      "details": { ... }
    }
  ]
}
```

#### Get Event Audit Summary
```http
GET /audit/events/:eventId/summary

Response: 200 OK
{
  "event_id": "event123",
  "total_kyc_verified": 5000,
  "lottery_participants": 5000,
  "tickets_sold": 100,
  "tickets_entered": 95,
  "refunds_processed": 5,
  "fraud_attempts": 0
}
```

## Smart Contract

### BlockTicSBT.sol

ERC-1155 Soulbound Token implementation with anti-scalping features.

#### Key Features
- **Non-Transferable Tickets**: Standard `transfer` and `transferFrom` functions are overridden and disabled
- **Platform-Controlled Lifecycle**: Only contract owner can mint and burn tokens
- **VRF Event Logging**: Records all lottery draw events on-chain
- **Compliance Ready**: Full audit trail and event logging

#### Contract Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BlockTicSBT is ERC1155, Ownable {
    // Mint ticket (owner only)
    function mint(address to, uint256 tokenId, uint256 amount) external onlyOwner

    // Burn ticket (owner only)
    function burn(address from, uint256 tokenId, uint256 amount) external onlyOwner

    // Disabled: transfer functions
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data)
        public override
    {
        revert("BlockTicSBT: Soulbound token cannot be transferred");
    }

    // VRF Draw event logging
    event VRFDrawCompleted(
        string indexed eventId,
        uint256 drawId,
        address vrfCoordinator,
        bytes32 requestId
    );
}
```

#### Deployment

```bash
# Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon

# Verify contract
npx hardhat verify --network polygon <CONTRACT_ADDRESS>
```

#### Integration with Backend

```typescript
// src/blockchain/contract-interaction.ts
const mintTicket = async (
  userWallet: string,
  eventId: string,
  ticketId: string
): Promise<TransactionHash> => {
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    BlockTicSBT_ABI,
    signer
  );

  const tx = await contract.mint(
    userWallet,
    tokenId,
    1 // amount: 1 ticket
  );

  await tx.wait(2); // Wait for 2 confirmations
  return tx.hash;
};
```

## AI Lightweight Design

### CompreFace Integration

**CompreFace** is a self-hosted, open-source face recognition service that runs on consumer-grade GPUs.

#### Architecture Benefits

1. **Self-Hosted**: Complete control over facial data
2. **GPU-Optimized**: ArcFace-r100 model optimized for inference
3. **Cost-Effective**: No per-request API costs after deployment
4. **Privacy-First**: Facial data never leaves your infrastructure

#### Hardware Acceleration

```
GPU Memory Usage (NVIDIA RTX 3080):
├── Model Loading:    ~2GB (ArcFace-r100)
├── Batch Processing: ~1GB (inference batch size 10)
└── Buffer/Cache:     ~1GB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Peak Usage:     ~4GB (well below 12GB VRAM)
```

#### Configuration

```yaml
# docker-compose.yml for CompreFace
services:
  compreface:
    image: exadel/compreface:1.3.0
    ports:
      - "3000:3000"
    environment:
      DB_USER: postgres
      DB_PASSWORD: password
      DB_HOST: postgres
      REDIS_HOST: redis
    volumes:
      - ./models:/opt/models
    devices:
      - /dev/nvidia0:/dev/nvidia0  # GPU access
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [compute, utility]
```

#### Cost Breakdown

| Component | Cost per Ticket |
|-----------|-----------------|
| CompreFace API | ~NT$0.20 (amortized) |
| AWS Rekognition | ~NT$2.50 |
| Gemini Vision API | ~NT$1.20 |
| EasyOCR (local) | ~NT$0.50 |
| Blockchain (Polygon) | ~NT$0.50 |
| **Total** | **~NT$5.00** |

### EasyOCR for ID Extraction

Local OCR running on CPU for fast ID card text extraction.

```python
# Local OCR pipeline (not in backend, for reference)
import easyocr
reader = easyocr.Reader(['en', 'zh'])
results = reader.readtext('id_card.jpg')
```

### Hybrid Cloud Option

For high-throughput scenarios:

```typescript
// src/ai/face-recognition.service.ts
async verifyFace(photo: Buffer, refPhotoId: string): Promise<FaceMatch> {
  try {
    // Try local CompreFace first
    return await this.comprface.match(photo, refPhotoId);
  } catch (error) {
    // Fallback to AWS Rekognition
    return await this.awsRekognition.compareFaces(photo, refPhotoId);
  }
}
```

## Development

### Project Structure

```
blocktic-backend/
├── src/
│   ├── modules/
│   │   ├── identity/        # KYC and face recognition
│   │   ├── lottery/         # Chainlink VRF integration
│   │   ├── seats/           # Seat allocation
│   │   ├── ticketing/       # Ticket lifecycle
│   │   ├── gate/            # Entry verification
│   │   ├── blockchain/      # Smart contract interaction
│   │   └── audit/           # Logging and compliance
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   └── interceptors/
│   ├── config/              # Environment configuration
│   ├── database/
│   │   ├── entities/        # TypeORM entities
│   │   └── migrations/      # Database migrations
│   └── main.ts
├── test/                    # Jest test suites
├── contracts/               # Solidity smart contracts
├── scripts/                 # Deployment and utility scripts
├── docker-compose.yml       # Development environment
├── .env.example             # Environment template
├── tsconfig.json
├── package.json
└── README.md
```

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Coverage report
npm run test:cov
```

### Code Style

```bash
# Format code with Prettier
npm run format

# Lint with ESLint
npm run lint

# Fix linting issues
npm run lint:fix
```

### Database Migrations

```bash
# Create a new migration
npm run typeorm migration:create -- -n CreateUsersTable

# Run pending migrations
npm run typeorm migration:run

# Revert last migration
npm run typeorm migration:revert
```

## Contributing

We welcome contributions from the community! Here's how you can help:

### Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/blocktic-backend.git
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Workflow

1. **Make your changes** and test thoroughly
2. **Write or update tests** for your changes
3. **Follow code style** with `npm run format && npm run lint:fix`
4. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add KYC verification endpoint"
   ```
5. **Push to your fork** and create a Pull Request

### Contribution Guidelines

- Code must pass all tests: `npm run test`
- Must include test coverage for new features
- Follow NestJS best practices and patterns
- Use TypeScript with strict mode enabled
- Document complex logic with comments
- Update README if adding new features
- Keep commits atomic and well-documented

### Reporting Issues

- Use GitHub Issues for bug reports
- Include steps to reproduce
- Provide environment details (Node version, OS, etc.)
- Attach relevant logs or screenshots

### Discussion & Ideas

- GitHub Discussions for feature requests
- Discord community for real-time chat
- Pull requests for implementation proposals

### Code of Conduct

Please be respectful and inclusive in all interactions. We're building this together!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [NestJS](https://nestjs.com) - Modern Node.js framework
- [Chainlink](https://chain.link) - VRF randomness
- [OpenZeppelin](https://openzeppelin.com) - Smart contract libraries
- [CompreFace](https://exadel.com/solutions/compreface/) - Face recognition
- [Polygon](https://polygon.technology) - Blockchain infrastructure
- All open-source contributors and community members

## Contact & Support

- 📧 Email: support@blocktic.example.com
- 🌐 Website: https://blocktic.example.com
- 💬 Discord: https://discord.gg/blocktic
- 🐦 Twitter: @BlockTicOfficial

---

**Last Updated**: March 2026
**Maintainer**: BlockTic Team
**Status**: Active Development
