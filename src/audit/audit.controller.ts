import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditSummaryDto } from './dto/audit-summary.dto';
import { AuditLog } from './entities/audit-log.entity';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get audit logs with pagination and optional filters' })
  @ApiOkResponse({
    description: 'Paginated list of audit log entries',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } },
        total: { type: 'number', example: 150 },
      },
    },
  })
  async getLogs(
    @Query() query: AuditQueryDto,
  ): Promise<{ data: AuditLog[]; total: number }> {
    return this.auditService.getLogs(query);
  }

  @Get('events/:eventId/summary')
  @ApiOperation({ summary: 'Get aggregated audit summary for an event' })
  @ApiParam({ name: 'eventId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Event audit summary', type: AuditSummaryDto })
  async getEventSummary(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<AuditSummaryDto> {
    return this.auditService.getEventSummary(eventId);
  }
}
