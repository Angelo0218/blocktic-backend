import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { GateLog } from '../gate-verification/entities/gate-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditSummaryDto } from './dto/audit-summary.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(GateLog)
    private readonly gateLogRepo: Repository<GateLog>,
    private readonly configService: ConfigService,
  ) {}

  /** Create an audit log entry. */
  async logAction(params: {
    eventId: string;
    userId?: string;
    action: AuditAction;
    details?: Record<string, any>;
    ipAddress?: string;
  }): Promise<AuditLog> {
    const log = this.auditLogRepo.create({
      eventId: params.eventId,
      userId: params.userId ?? null,
      action: params.action,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    return this.auditLogRepo.save(log);
  }

  /** Query audit logs with pagination and optional filters. */
  async getLogs(query: AuditQueryDto): Promise<{ data: AuditLog[]; total: number }> {
    const { page = 1, limit = 20, eventId, action } = query;

    const where: Record<string, any> = {};
    if (eventId) where.eventId = eventId;
    if (action) where.action = action;

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  /** Aggregate audit stats for a specific event. */
  async getEventSummary(eventId: string): Promise<AuditSummaryDto> {
    const actionCounts = await this.auditLogRepo
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)::int', 'count')
      .where('log.eventId = :eventId', { eventId })
      .groupBy('log.action')
      .getRawMany<{ action: string; count: number }>();

    const totalLogs = actionCounts.reduce((sum, r) => sum + r.count, 0);

    const boundaries = await this.auditLogRepo
      .createQueryBuilder('log')
      .select('MIN(log.createdAt)', 'firstLogAt')
      .addSelect('MAX(log.createdAt)', 'lastLogAt')
      .where('log.eventId = :eventId', { eventId })
      .getRawOne<{ firstLogAt: Date | null; lastLogAt: Date | null }>();

    return {
      eventId,
      totalLogs,
      actionCounts,
      firstLogAt: boundaries?.firstLogAt ?? null,
      lastLogAt: boundaries?.lastLogAt ?? null,
    };
  }

  /**
   * Scheduled job: every hour, find events that ended more than 24 h ago
   * and delete their CompreFace face-collection data.
   *
   * The cleanup targets audit logs marked as data_cleanup that have not
   * yet been processed. In a full implementation this would call the
   * CompreFace API to remove the collection; here we log the action and
   * record it as an audit entry.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupEventData(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.logger.log(`Running scheduled cleanup for events ended before ${cutoff.toISOString()}`);

    // 從 gate_logs 表找出有驗票紀錄且超過 24 小時的活動，
    // 且在 audit_logs 中尚未有 data_cleanup 紀錄（代表尚未清理）。
    const eventsToClean = await this.gateLogRepo
      .createQueryBuilder('gl')
      .select('DISTINCT gl.eventId', 'eventId')
      .where('gl.verifiedAt <= :cutoff', { cutoff })
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(AuditLog, 'cleanup')
          .where('cleanup.eventId = gl.eventId')
          .andWhere('cleanup.action = :cleanupAction')
          .getQuery();
        return `NOT EXISTS ${sub}`;
      })
      .setParameter('cleanupAction', AuditAction.DATA_CLEANUP)
      .getRawMany<{ eventId: string }>();

    const compreFaceBaseUrl = this.configService.get<string>(
      'COMPREFACE_API_URL',
      'http://localhost:8000',
    );
    const compreFaceApiKey = this.configService.get<string>('COMPREFACE_API_KEY', '');

    for (const { eventId } of eventsToClean) {
      try {
        this.logger.log(`Deleting CompreFace collection for event ${eventId}`);

        const url = `${compreFaceBaseUrl}/api/v1/recognition/subjects/${eventId}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'x-api-key': compreFaceApiKey },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok && response.status !== 404) {
          // 刪除失敗時不記錄 DATA_CLEANUP，下次排程會重試
          this.logger.warn(
            `CompreFace deletion returned ${response.status} for event ${eventId}, will retry next cycle`,
          );
          continue;
        }

        // 只有成功刪除（或 404 已不存在）時才記錄清理完成
        await this.logAction({
          eventId,
          action: AuditAction.DATA_CLEANUP,
          details: { reason: 'scheduled_24h_post_event', status: response.status },
        });

        this.logger.log(`Cleanup complete for event ${eventId}`);
      } catch (error) {
        // 網路錯誤或 timeout，不記錄 DATA_CLEANUP，下次排程會重試
        this.logger.error(`Cleanup failed for event ${eventId}, will retry next cycle`, error);
      }
    }
  }
}
