---
description: 為指定模組建立單元測試
arguments:
  - name: module
    description: "模組名稱 (identity | lottery | seat-allocation | ticketing | gate-verification | blockchain | audit)"
    required: true
---

針對 src/$module/ 模組：
1. 讀取 .service.ts 和 .controller.ts
2. 建立或更新 .spec.ts 測試檔案
3. 使用 Jest + @nestjs/testing
4. mock 外部依賴（TypeORM Repository、Redis、CompreFace、AWS、ECPay）
5. 測試正常流程 + 各種拒絕/錯誤情境
6. 執行 `npm test -- --testPathPattern=$module` 確認通過
