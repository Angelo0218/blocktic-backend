import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Event } from './entities/event.entity';
import { Zone } from './entities/zone.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Zone)
    private readonly zoneRepo: Repository<Zone>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateEventDto): Promise<Event> {
    const event = this.eventRepo.create({
      ...dto,
      zones: dto.zones.map((z) => this.zoneRepo.create(z)),
    });
    return this.eventRepo.save(event);
  }

  async findAll(
    query: EventQueryDto,
  ): Promise<{ data: Event[]; total: number }> {
    const { page = 1, limit = 20, status } = query;
    const where: Record<string, any> = {};
    if (status) where.status = status;

    const [data, total] = await this.eventRepo.findAndCount({
      where,
      order: { startTime: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['zones'],
    });

    return { data, total };
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['zones'],
    });
    if (!event) throw new NotFoundException('活動不存在');
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(Event, {
        where: { id },
        relations: ['zones'],
      });
      if (!event) throw new NotFoundException('活動不存在');

      if (dto.zones) {
        await manager.delete(Zone, { eventId: id });
        event.zones = dto.zones.map((z) =>
          manager.create(Zone, { ...z, eventId: id }),
        );
      }

      Object.assign(event, { ...dto, zones: event.zones });
      return manager.save(Event, event);
    });
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepo.remove(event);
  }
}
