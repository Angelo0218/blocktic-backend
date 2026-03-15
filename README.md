# BlockTic Backend

AI-powered anti-scalper ticketing system with VRF verifiable lottery, face KYC, and blockchain audit trail.

## Architecture

NestJS modular monolith with 6 core modules:

| Module | Description |
|--------|-------------|
| **Identity/KYC** | 4-layer defense: ID uniqueness + AWS Liveness + CompreFace 1:1 + 1:N dedup |
| **Lottery** | Chainlink VRF verifiable fair lottery on Polygon |
| **Seat Allocation** | Auto consecutive seating with `FOR UPDATE SKIP LOCKED` |
| **Ticketing** | ECPay pre-auth + ERC-1155 mint/burn + refund-to-waitlist |
| **Gate Verification** | Dynamic QR (60s JWT) + face compare + offline fallback |
| **Audit** | Immutable logs + scheduled data cleanup (GDPR) |

## Tech Stack

- **Runtime:** Node.js 22 + NestJS
- **Database:** PostgreSQL 15 + Redis 7 (BullMQ)
- **AI (Local GPU):** CompreFace (ArcFace-r100) + EasyOCR
- **AI (Cloud):** Gemini 2.5 Flash Vision (ID OCR) + AWS Rekognition (Liveness)
- **Blockchain:** Polygon PoS + Chainlink VRF v2.5 + ERC-1155
- **Payment:** ECPay (pre-authorization mode)

> All technologies are non-Chinese developed (compliant with competition rules).

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Run development server
npm run start:dev

# 5. Open Swagger docs
open http://localhost:3000/api
```

## Hardware Requirements

- **GPU:** NVIDIA RTX 3080 12GB (for CompreFace + EasyOCR, ~3GB VRAM)
- **RAM:** 32GB
- **Storage:** 50GB SSD

## API Modules

### Identity/KYC (`/identity`)
- `POST /identity/kyc` - Submit KYC verification
- `GET /identity/kyc/status/:userId` - Check KYC status
- `DELETE /identity/:userId` - Delete user data (GDPR)

### Lottery (`/lottery`)
- `POST /lottery/events/:eventId/register` - Register for lottery
- `POST /lottery/events/:eventId/draw` - Trigger VRF draw (admin)
- `GET /lottery/events/:eventId/results` - Get draw results
- `GET /lottery/events/:eventId/proof` - Get on-chain proof

### Seat Allocation (`/seats`)
- `POST /seats/events/:eventId/allocate` - Auto-allocate seats
- `GET /seats/events/:eventId/map` - Get seat availability
- `DELETE /seats/:seatId/release` - Release seat

### Ticketing (`/tickets`)
- `POST /tickets/events/:eventId/preauth` - Pre-authorize payment
- `POST /tickets/:ticketId/capture` - Capture payment
- `POST /tickets/:ticketId/mint` - Mint ERC-1155
- `POST /tickets/:ticketId/refund` - Refund to waitlist
- `GET /tickets/user/:userId` - User's tickets

### Gate Verification (`/gate`)
- `POST /gate/qr/generate` - Generate dynamic QR
- `POST /gate/verify` - Verify entry (QR + face)
- `POST /gate/verify/fallback` - Fallback with ID number
- `GET /gate/events/:eventId/stats` - Entry stats

### Audit (`/audit`)
- `GET /audit/logs` - Query audit logs
- `GET /audit/events/:eventId/summary` - Event summary

## AI Lightweight Design

This system adopts an **AI lightweight architecture** optimized for edge deployment:

1. **CompreFace** runs locally on consumer GPU (RTX 3080), using only ~3GB of 12GB VRAM
2. **EasyOCR** serves as offline backup, requiring only ~300MB VRAM
3. Cloud AI services (Gemini Flash, AWS Rekognition) are used only for tasks requiring highest accuracy
4. Per-ticket AI cost: < NT$5 (combining local + cloud)

## License

MIT
