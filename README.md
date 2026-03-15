# BlockTic 後端服務

以 AI 驗證為核心、區塊鏈為公平稽核輔助的智慧防黃牛票務系統。

## 系統架構

NestJS 模組化單體後端，包含 7 大核心模組：

| 模組 | 說明 |
|------|------|
| **Identity / KYC** | 四層防線：證件唯一性 + AWS 活體偵測 + CompreFace 1:1 比對 + 1:N 人臉去重 |
| **Lottery** | Chainlink VRF 可驗證公平抽籤（Polygon 鏈上） |
| **Seat Allocation** | 自動配位 + 團票連號（`FOR UPDATE SKIP LOCKED` 並發安全） |
| **Ticketing** | ECPay 預授權 + SBT 靈魂綁定票券鑄造/銷毀 + 退票回候補池 |
| **Gate Verification** | 動態 QR（60 秒 JWT）+ 人臉比對 + 離線備援 + fallback 證件驗證 |
| **Blockchain** | SBT 合約互動 + ERC-4337 帳戶抽象（AA 錢包 + Paymaster 代付 gas） |
| **Audit** | 不可竄改稽核紀錄 + 排程資料清理（符合個資法） |

## 技術堆疊

- **執行環境：** Node.js 22 + NestJS
- **資料庫：** PostgreSQL 15 + Redis 7（BullMQ 任務佇列）
- **本機 AI（GPU）：** CompreFace（ArcFace-r100 人臉辨識）+ EasyOCR（離線 OCR 備援）
- **雲端 AI：** Gemini 2.5 Flash Vision（證件 OCR）+ AWS Rekognition（活體偵測）
- **區塊鏈：** Polygon PoS + Chainlink VRF v2.5 + SBT（靈魂綁定代幣）+ ERC-4337 帳戶抽象
- **金流：** ECPay 綠界科技（預授權模式）

> 所有技術均非中國開發，符合競賽須知第九條第七款規定。

## 快速開始

```bash
# 1. 啟動基礎設施（PostgreSQL + Redis + CompreFace）
docker compose up -d

# 2. 安裝相依套件
npm install

# 3. 設定環境變數
cp .env.example .env

# 4. 啟動開發伺服器
npm run start:dev

# 5. 開啟 Swagger API 文件
open http://localhost:3000/api
```

## 硬體需求

- **GPU：** NVIDIA RTX 3080 12GB（CompreFace + EasyOCR 僅佔 ~3GB VRAM）
- **記憶體：** 32GB RAM
- **儲存：** 50GB SSD

## API 端點

### 身分驗證 / KYC（`/identity`）
- `POST /identity/kyc` — 提交 KYC 驗證（上傳證件照 + 自拍照）
- `GET /identity/kyc/status/:userId` — 查詢 KYC 狀態
- `DELETE /identity/:userId` — 刪除使用者資料（符合個資法）

### 抽籤（`/lottery`）
- `POST /lottery/events/:eventId/register` — 登記抽籤（選擇票區 + 人數）
- `POST /lottery/events/:eventId/draw` — 觸發 VRF 抽籤（管理員）
- `GET /lottery/events/:eventId/results` — 查詢抽籤結果
- `GET /lottery/events/:eventId/proof` — 取得鏈上抽籤證明

### 座位配置（`/seats`）
- `POST /seats/events/:eventId/allocate` — 自動配位（團票連號）
- `GET /seats/events/:eventId/map` — 查詢座位可用狀態
- `DELETE /seats/:seatId/release` — 釋放座位（退票用）

### 票務（`/tickets`）
- `POST /tickets/events/:eventId/preauth` — ECPay 預授權扣款（21 天）
- `POST /tickets/:ticketId/capture` — 中籤後請款
- `POST /tickets/:ticketId/mint` — 鑄造 SBT 靈魂綁定票券（不可轉讓）
- `POST /tickets/:ticketId/refund` — 退票（退款 + burn + 回候補池）
- `GET /tickets/user/:userId` — 查詢使用者的票券
- `GET /tickets/:ticketId` — 查詢單張票券詳情

### 入場驗證（`/gate`）
- `POST /gate/qr/generate` — 產生動態 QR（JWT 含 ticketId + nonce，60 秒過期）
- `POST /gate/verify` — 驗證入場（掃 QR + 人臉比對）
- `POST /gate/verify/fallback` — 備援驗證（出示證件號碼）
- `GET /gate/events/:eventId/stats` — 入場統計數據

### 稽核（`/audit`）
- `GET /audit/logs` — 查詢稽核紀錄（支援分頁與篩選）
- `GET /audit/events/:eventId/summary` — 活動稽核摘要

## 區塊鏈架構：SBT + 帳戶抽象

### 三種鏈上代幣

| 鏈上代幣 | 用途 | 標準 | 可轉讓？ |
|----------|------|------|---------|
| **KYC Attestation SBT** | 證明一人一資格（不含個資） | ERC-1155 + Soulbound 覆寫 | 不可轉讓 |
| **Ticket SBT** | 票券所有權與狀態 | ERC-1155 + Soulbound 覆寫 | 不可轉讓 |
| VRF Draw Proof | 抽籤結果紀錄 | 合約 event log | 純紀錄 |

### 為什麼用 SBT（不是普通 ERC-1155）

- **合約層強制不可轉讓**：覆寫 `safeTransferFrom`，只有平台 owner 可執行，黃牛即使拿到私鑰也無法鏈上轉票
- **退票只有平台可操作**：`burn` 函數為 `onlyOwner`，防止未經授權的銷毀
- 智能合約原始碼位於 `contracts/BlockTicSBT.sol`

### ERC-4337 帳戶抽象（使用者零門檻）

| 問題 | 傳統做法 | BlockTic 做法 |
|------|---------|-------------|
| 需要錢包嗎 | 要（MetaMask） | 不用，KYC 通過時後台自動建立 AA 錢包 |
| 需要持有 POL 付 gas 嗎 | 要 | 不用，平台 Paymaster 代付（每人全生命週期 < NT$0.05） |
| 使用者體驗 | 「請確認交易...」 | 完全無感，跟用拓元一樣 |

## AI 輕量化設計

本系統採用 **AI 輕量化混合架構**，針對邊緣部署優化：

1. **CompreFace** 人臉辨識在本機消費級 GPU（RTX 3080）運行，僅佔用 ~3GB / 12GB VRAM
2. **EasyOCR** 作為離線 OCR 備援，僅需 ~300MB VRAM
3. 雲端 AI 服務（Gemini Flash、AWS Rekognition）僅在需要最高精度時使用，避免不必要的雲端開銷
4. 每張票 AI 總成本 < NT$5，結合本機推論與雲端 API 的高效混合架構
5. 本機 GPU 總 VRAM 使用量僅 ~3GB，保留 9GB 餘裕空間供未來擴展

## 開源技術合規聲明

本系統採用之所有開源技術均依其授權條款合法使用，所有業務邏輯、AI 串接流程與系統架構為團隊原創設計。

| 技術 | 開發者 / 國家 | 授權 | 使用義務 |
|------|-------------|------|---------|
| NestJS | Kamil Mysliwiec（波蘭） | MIT | 保留版權聲明 |
| PostgreSQL | PGDG（國際） | PostgreSQL License | 保留版權聲明 |
| Redis | Redis Ltd（美國） | BSD-3 | 保留版權聲明 |
| BullMQ | Taskforce.sh（美國） | MIT | 保留版權聲明 |
| CompreFace | Exadel（美國） | Apache 2.0 | 保留 LICENSE + NOTICE，標註修改 |
| EasyOCR | JaidedAI（泰國） | Apache 2.0 | 保留 LICENSE + NOTICE，標註修改 |
| Expo | Expo（美國） | MIT | 保留版權聲明 |
| React Native | Meta（美國） | MIT | 保留版權聲明 |
| Next.js | Vercel（美國） | MIT | 保留版權聲明 |
| OpenZeppelin | OpenZeppelin（阿根廷/美國） | MIT | 保留版權聲明 |
| Chainlink VRF | Chainlink Labs（美國） | MIT | 保留版權聲明 |
| ERC-4337（帳戶抽象） | Ethereum Foundation（國際） | MIT | 標準規範 |
| Gemini API | Google（美國） | 商業 API | 依使用條款付費呼叫 |
| AWS Rekognition | Amazon（美國） | 商業 API | 依使用條款付費呼叫 |
| ECPay SDK | 綠界科技（台灣） | 商業 | 依合約串接 |

> 上述開源技術均為工具層使用（如同使用 Word 撰寫文件），本作品之 KYC 四層防線設計、VRF 抽籤流程、SBT 靈魂綁定票券機制、ERC-4337 帳戶抽象整合、動態 QR 驗票機制、退票回候補池等核心業務邏輯皆為團隊原創，不涉及任何智慧財產權侵權。

## 授權條款

MIT
