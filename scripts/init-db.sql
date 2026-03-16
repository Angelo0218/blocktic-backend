-- BlockTic 開發環境初始化
-- TypeORM synchronize=true 會自動建表，這裡只做 extension 啟用

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
