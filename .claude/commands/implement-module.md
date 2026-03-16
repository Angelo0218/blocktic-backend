---
description: 實作指定模組的 stub 方法
arguments:
  - name: module
    description: "模組名稱 (identity | lottery | ticketing | gate-verification | blockchain)"
    required: true
---

針對 src/$module/ 模組：
1. 讀取該模組所有 .service.ts 檔案
2. 找出所有 TODO 和 STUB 標記的方法
3. 對照 docs/blocktic_final_architecture_v2.md 的架構要求
4. 逐一實作每個 stub 方法，串接真實的外部 API
5. 確保錯誤處理和 fallback 機制完善
6. 用繁體中文撰寫註解

實作前先列出所有待實作方法，確認後再開始寫 code。
