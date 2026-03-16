# BlockTic API Endpoints Reference

> 自動產生於 2026-03-16。完整互動式文件請啟動開發伺服器後至 `http://localhost:3000/api` 查看 Swagger UI。

## 總覽

| 模組 | 端點數 | 認證需求 |
|------|--------|---------|
| Auth | 3 | 部分（register 需 JWT） |
| Identity / KYC | 3 | JWT（admin 限定 delete） |
| Events | 5 | GET 公開，寫入需 Admin |
| Lottery | 4 | 部分（register 需 JWT，draw 需 Admin） |
| Ticketing | 7 | JWT（callback 除外，admin 限定 capture/mint） |
| Seat Allocation | 3 | JWT（admin 限定 allocate/release） |
| Gate Verification | 4 | JWT（admin 限定 verify/stats） |
| Notifications | 2 | JWT |
| Audit | 2 | 公開 |
| Health | 1 | 公開 |

**共計 34 個端點**

---

## Auth（認證）

### POST /auth/otp/send
發送 OTP 驗證碼至手機（mock 模式，固定 `123456`）

- **認證**: 無
- **Request Body**: `SendOtpDto`
  ```json
  { "phone": "0912345678" }
  ```
- **Response 200**: `{ "message": "OTP 已發送" }`

### POST /auth/otp/verify
驗證 OTP 並取得 JWT token

- **認證**: 無
- **Request Body**: `VerifyOtpDto`
  ```json
  { "phone": "0912345678", "code": "123456" }
  ```
- **Response 200**: `VerifyOtpResponseDto`
  ```json
  { "token": "eyJ...", "isNewUser": true, "userId": "uuid" }
  ```
- **Error 400**: OTP 驗證碼錯誤 / 請先發送 OTP / 驗證次數過多

### POST /auth/register
完成註冊（填寫姓名、暱稱）

- **認證**: JWT Bearer
- **Request Body**: `RegisterDto`
  ```json
  { "name": "王小明", "nickname": "小明" }
  ```
- **Response 200**: User 資料
- **Error 409**: 使用者已完成註冊

---

## Events（活動）

### GET /events
取得活動列表（支援分頁與 status 篩選）

- **認證**: 無
- **Query Parameters**:
  - `page` (int, default: 1)
  - `limit` (int, default: 20, max: 100)
  - `status` (enum: DRAFT/PUBLISHED/REGISTRATION/DRAWN/ACTIVE/COMPLETED/CANCELLED)
- **Response 200**: `{ "data": EventResponseDto[], "total": number }`

### GET /events/:id
取得活動詳情（含票區資訊）

- **認證**: 無
- **Response 200**: `EventResponseDto`（含 `zones: ZoneResponseDto[]`）
- **Error 404**: 活動不存在

### POST /events
建立活動（admin）

- **認證**: JWT Bearer + Admin
- **Request Body**: `CreateEventDto`
  ```json
  {
    "name": "2026 五月天演唱會",
    "description": "...",
    "coverImage": "https://...",
    "startTime": "2026-05-01T19:00:00+08:00",
    "endTime": "2026-05-01T22:00:00+08:00",
    "registrationStart": "2026-04-01T00:00:00+08:00",
    "registrationEnd": "2026-04-15T23:59:59+08:00",
    "verificationMode": "STRONG",
    "organizerName": "相信音樂",
    "address": "台北小巨蛋",
    "zones": [
      { "name": "VIP", "price": 5800, "depositRate": 0.4, "totalSeats": 200 },
      { "name": "A 區", "price": 3800, "depositRate": 0.4, "totalSeats": 500 }
    ]
  }
  ```
- **Response 201**: `EventResponseDto`

### PATCH /events/:id
更新活動（admin）

- **認證**: JWT Bearer + Admin
- **Request Body**: `UpdateEventDto`（所有欄位皆為 optional）
- **Response 200**: `EventResponseDto`

### DELETE /events/:id
刪除活動（admin）

- **認證**: JWT Bearer + Admin
- **Response 204**: 無內容

---

## Notifications（通知）

### GET /notifications
取得當前使用者的通知列表

- **認證**: JWT Bearer
- **Query Parameters**:
  - `page` (int, default: 1)
  - `limit` (int, default: 20, max: 100)
- **Response 200**: `{ "data": NotificationResponseDto[], "total": number }`

### PATCH /notifications/:id/read
標記通知為已讀

- **認證**: JWT Bearer
- **Response 200**: `NotificationResponseDto`
- **Error 404**: 通知不存在

---

## Identity / KYC（身分驗證）

### POST /identity/kyc
提交 KYC 四層驗證

- **認證**: JWT Bearer（限速 3 次/分）
- **Request Body**: `SubmitKycDto`（idCardImage, selfieImage, consent, userId?）
- **Response 201**: `KycSubmitResponseDto`

### GET /identity/kyc/status/:userId
查詢 KYC 狀態

- **認證**: JWT Bearer
- **Response 200**: `KycStatusResponseDto`

### DELETE /identity/:userId
刪除使用者資料（GDPR）

- **認證**: JWT Bearer + Admin
- **Response 200**: `{ "deleted": true }`

---

## Lottery（抽籤）

### POST /lottery/events/:eventId/register
登記抽籤

- **認證**: JWT Bearer
- **Request Body**: `RegisterLotteryDto` — `{ "zoneId": "uuid", "groupSize": 1-8 }`
- **Response 201**: `LotteryEntry`

### POST /lottery/events/:eventId/draw
執行 Chainlink VRF 抽籤（admin）

- **認證**: JWT Bearer + Admin
- **Response 201**: `DrawResultResponseDto`

### GET /lottery/events/:eventId/results
查看抽籤結果

- **認證**: 無
- **Response 200**: `DrawResultResponseDto`

### GET /lottery/events/:eventId/proof
查看鏈上 VRF 證明

- **認證**: 無
- **Response 200**: `DrawProofResponseDto`

---

## Ticketing（票券）

### POST /tickets/events/:eventId/preauth
ECPay 預授權（21 天凍結）

- **認證**: JWT Bearer
- **Request Body**: `PreauthDto` — `{ "userId": "uuid", "amount": 1500, "returnUrl": "https://..." }`
- **Response 201**: `{ "ticket": TicketResponseDto, "paymentFormData": {...} }`

### POST /tickets/:ticketId/capture
請款（admin）

- **認證**: JWT Bearer + Admin
- **Response 201**: `TicketResponseDto`

### POST /tickets/:ticketId/mint
Mint SBT（admin）

- **認證**: JWT Bearer + Admin
- **Response 201**: `TicketResponseDto`

### POST /tickets/:ticketId/refund
退票

- **認證**: JWT Bearer
- **Response 201**: `TicketResponseDto`

### POST /tickets/ecpay/callback
ECPay 伺服器回呼（webhook）

- **認證**: CheckMacValue 驗證
- **Response 200**: `"1|OK"`

### GET /tickets/user/:userId
取得使用者所有票券

- **認證**: JWT Bearer
- **Response 200**: `TicketResponseDto[]`

### GET /tickets/:ticketId
取得票券詳情

- **認證**: JWT Bearer
- **Response 200**: `TicketResponseDto`

---

## Seat Allocation（配位）

### POST /seats/events/:eventId/allocate
配位（admin，FOR UPDATE SKIP LOCKED）

- **認證**: JWT Bearer + Admin
- **Request Body**: `AllocateSeatsDto`
- **Response 201**: `AllocationResultDto`

### GET /seats/events/:eventId/map
取得座位圖

- **認證**: JWT Bearer
- **Response 200**: `SeatMapResponseDto`

### DELETE /seats/:seatId/release
釋放座位（admin）

- **認證**: JWT Bearer + Admin
- **Response 204**: 無內容

---

## Gate Verification（入場驗證）

### POST /gate/qr/generate
產生動態 QR Code（JWT，60 秒過期）

- **認證**: JWT Bearer
- **Request Body**: `GenerateQrDto` — `{ "ticketId": "uuid" }`
- **Response 201**: `{ "qrToken": "..." }`

### POST /gate/verify
QR + 人臉驗票（admin/staff）

- **認證**: JWT Bearer + Admin
- **Request Body**: `VerifyEntryDto`
- **Response 201**: Gate log entry

### POST /gate/verify/fallback
證件號碼 Fallback 驗票（admin）

- **認證**: JWT Bearer + Admin
- **Request Body**: `FallbackVerifyDto`
- **Response 201**: Gate log entry

### GET /gate/events/:eventId/stats
入場統計（admin）

- **認證**: JWT Bearer + Admin
- **Response 200**: Entry statistics

---

## Audit（稽核）

### GET /audit/logs
查詢稽核日誌（分頁 + 篩選）

- **認證**: 無
- **Query**: `page`, `limit`, `eventId`, `action`
- **Response 200**: `{ "data": AuditLog[], "total": number }`

### GET /audit/events/:eventId/summary
活動稽核摘要

- **認證**: 無
- **Response 200**: `AuditSummaryDto`

---

## Health

### GET /
健康檢查

- **認證**: 無
- **Response 200**: `{ "status": "ok", "service": "BlockTic API", "version": "0.1.0" }`
