import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 新增 ecpayTradeNo 欄位至 tickets 表。
 * ECPay 處理端指派的交易號（從 callback 取得），DoAction 請款/退款時需要。
 */
export class AddEcpayTradeNo1742572800000 implements MigrationInterface {
  name = 'AddEcpayTradeNo1742572800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "ecpayTradeNo" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP COLUMN IF EXISTS "ecpayTradeNo"`,
    );
  }
}
