import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Seat, SeatStatus } from './entities/seat.entity';
import { Venue } from './entities/venue.entity';
import { AllocateSeatsDto } from './dto/allocate-seats.dto';
import {
  AllocationResultDto,
  SeatMapResponseDto,
  ZoneSummaryDto,
  RowSummaryDto,
} from './dto/seat-map.dto';
import { findConsecutiveSeats } from '../common/utils/seat-utils';

@Injectable()
export class SeatAllocationService {
  private readonly logger = new Logger(SeatAllocationService.name);

  constructor(
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Allocate consecutive seats for a lottery winner within a single
   * PostgreSQL transaction using FOR UPDATE SKIP LOCKED to avoid
   * blocking concurrent allocations.
   */
  async allocateSeats(
    eventId: string,
    dto: AllocateSeatsDto,
  ): Promise<AllocationResultDto> {
    const { groupSize, zoneId } = dto;
    const allocationId = uuidv4();

    return this.dataSource.transaction(async (manager) => {
      // Fetch available seats in the requested zone, ordered by row and
      // seat number so we can look for consecutive runs.  FOR UPDATE
      // SKIP LOCKED ensures concurrent requests never compete for the
      // same rows.
      const available: Seat[] = await manager
        .createQueryBuilder(Seat, 's')
        .where('s.eventId = :eventId', { eventId })
        .andWhere('s.zoneId = :zoneId', { zoneId })
        .andWhere('s.status = :status', { status: SeatStatus.AVAILABLE })
        .orderBy('s.row', 'ASC')
        .addOrderBy('s.seatNumber', 'ASC')
        .setLock('pessimistic_write_or_fail')
        .setOnLocked('skip_locked')
        .getMany();

      // Find a consecutive run of `groupSize` seats in the same row.
      const consecutive = findConsecutiveSeats(available, groupSize);

      if (!consecutive) {
        throw new ConflictException(
          `No ${groupSize} consecutive available seats in zone ${zoneId} for event ${eventId}`,
        );
      }

      const now = new Date();

      for (const seat of consecutive) {
        seat.status = SeatStatus.ALLOCATED;
        seat.allocatedAt = now;
      }

      const saved = await manager.save(Seat, consecutive);

      this.logger.log(
        `Allocated ${groupSize} seats (${allocationId}) in zone ${zoneId} row ${saved[0].row} seats ${saved[0].seatNumber}-${saved[saved.length - 1].seatNumber}`,
      );

      return {
        allocationId,
        seats: saved.map((s) => ({
          id: s.id,
          zoneId: s.zoneId,
          row: s.row,
          seatNumber: s.seatNumber,
          status: s.status,
        })),
      };
    });
  }

  /**
   * Return the seat map with availability counts grouped by zone and row.
   */
  async getSeatMap(eventId: string): Promise<SeatMapResponseDto> {
    const rows: {
      zoneId: string;
      row: string;
      total: string;
      available: string;
    }[] = await this.seatRepo
      .createQueryBuilder('s')
      .select('s.zoneId', 'zoneId')
      .addSelect('s.row', 'row')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE s.status = '${SeatStatus.AVAILABLE}')::int`,
        'available',
      )
      .where('s.eventId = :eventId', { eventId })
      .groupBy('s.zoneId')
      .addGroupBy('s.row')
      .orderBy('s.zoneId', 'ASC')
      .addOrderBy('s.row', 'ASC')
      .getRawMany();

    if (rows.length === 0) {
      throw new NotFoundException(
        `No seats found for event ${eventId}`,
      );
    }

    const zonesMap = new Map<string, RowSummaryDto[]>();

    for (const r of rows) {
      const list = zonesMap.get(r.zoneId) ?? [];
      list.push({
        row: r.row,
        totalSeats: Number(r.total),
        availableSeats: Number(r.available),
      });
      zonesMap.set(r.zoneId, list);
    }

    const zones: ZoneSummaryDto[] = [];
    let totalSeats = 0;
    let totalAvailable = 0;

    for (const [zoneId, rowList] of zonesMap) {
      const zoneTotal = rowList.reduce((sum, r) => sum + r.totalSeats, 0);
      const zoneAvailable = rowList.reduce(
        (sum, r) => sum + r.availableSeats,
        0,
      );
      zones.push({
        zoneId,
        rows: rowList,
        totalSeats: zoneTotal,
        availableSeats: zoneAvailable,
      });
      totalSeats += zoneTotal;
      totalAvailable += zoneAvailable;
    }

    return { eventId, zones, totalSeats, totalAvailable };
  }

  /**
   * Release a previously allocated seat back to available status.
   */
  async releaseSeat(seatId: string): Promise<void> {
    const seat = await this.seatRepo.findOne({ where: { id: seatId } });

    if (!seat) {
      throw new NotFoundException(`Seat ${seatId} not found`);
    }

    if (seat.status === SeatStatus.AVAILABLE) {
      throw new ConflictException(`Seat ${seatId} is already available`);
    }

    if (seat.status === SeatStatus.USED) {
      throw new ConflictException(
        `Seat ${seatId} has already been used and cannot be released`,
      );
    }

    seat.status = SeatStatus.AVAILABLE;
    seat.ticketId = null;
    seat.allocatedAt = null;
    await this.seatRepo.save(seat);

    this.logger.log(`Released seat ${seatId}`);
  }

}
