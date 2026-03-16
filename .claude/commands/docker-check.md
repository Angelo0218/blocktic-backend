---
description: 檢查 Docker 開發環境狀態
---

執行以下檢查：
1. `docker compose ps` — 所有容器是否在運行
2. `docker compose logs --tail=20 backend` — backend 最近日誌
3. 檢查 PostgreSQL 連線是否正常
4. 檢查 Redis 連線是否正常
5. 檢查 CompreFace API 是否可用（curl http://localhost:8000/status）

如果有服務未啟動，提供修復建議。
