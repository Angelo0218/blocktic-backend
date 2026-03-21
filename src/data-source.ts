import { DataSource } from 'typeorm';
import 'dotenv/config';

/**
 * TypeORM CLI 用 DataSource（migration:run / migration:generate / migration:revert）。
 * 與 app.module.ts 中的設定保持一致。
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'blocktic',
  password: process.env.DB_PASSWORD ?? 'blocktic',
  database: process.env.DB_DATABASE ?? 'blocktic',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});
