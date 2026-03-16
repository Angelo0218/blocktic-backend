# BlockTic Backend

## 專案概述
BlockTic 是一套以 AI 驗證為核心、區塊鏈為公平稽核輔助的智慧票務系統。
競賽：2026 智慧創新大賞（AI 應用類 · 學生組）

## 技術棧
- **框架**: NestJS 11（模組化單體）
- **語言**: TypeScript（strict mode, ES2023 target）
- **資料庫**: PostgreSQL 15 + TypeORM
- **快取/佇列**: Redis 7 + BullMQ
- **AI**: CompreFace 1.2.0（人臉辨識）、Gemini 2.5 Flash（證件 OCR）、AWS Rekognition（活體偵測）
- **區塊鏈**: Polygon PoS + ERC-4337 AA + Chainlink VRF v2.5 + OpenZeppelin
- **金流**: ECPay 綠界
- **部署**: Docker Compose

## 開發環境
```bash
cp .env.example .env
docker compose up --build
```
- Backend: http://localhost:3000
- CompreFace UI: http://localhost:8002
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## 模組結構
```
src/
├── identity/        # KYC 四層防線（證件 OCR + 活體 + 1:1 + 1:N）
├── lottery/         # Chainlink VRF 可驗證抽籤
├── seat-allocation/ # 自動配位 + 團票連號（FOR UPDATE SKIP LOCKED）
├── ticketing/       # ECPay 預授權 + SBT mint/burn
├── gate-verification/ # 動態 QR + 人臉驗票
├── blockchain/      # ERC-4337 AA 錢包 + SBT 合約互動
├── audit/           # 稽核日誌 + 排程清理
└── common/          # 共用 DTO、Guard、Decorator
```

## 編碼規範
- 使用繁體中文撰寫註解和文件
- Entity 使用 TypeORM decorator，資料表名用複數（e.g. `persons`, `tickets`）
- DTO 使用 class-validator + class-transformer
- API 使用 @nestjs/swagger decorator
- 錯誤回應使用 NestJS 內建 Exception（BadRequestException, ConflictException 等）
- 環境變數透過 @nestjs/config 的 ConfigService 注入，不直接 process.env

## 常用指令
```bash
npm run start:dev      # 開發模式（hot-reload）
npm run build          # 編譯
npm run test           # 單元測試
npm run lint           # ESLint
docker compose up -d   # 啟動所有服務
docker compose logs -f backend  # 看 backend 日誌
```

## 重要提醒
- 所有技術均非中國開發（符合競賽須知第九條第七款）
- 不把個資上鏈，鏈上只存 hash 和 SBT
- SBT 是 Soulbound（不可轉讓），transfer 函數被覆寫
- 帳戶抽象讓使用者零區塊鏈門檻（不需 MetaMask、不需持有 POL）
- 架構文件：docs/blocktic_final_architecture_v2.md
