import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async create(params: {
    userId: string;
    title: string;
    body: string;
    type: NotificationType;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    const notif = this.notifRepo.create(params);
    return this.notifRepo.save(notif);
  }

  async findByUser(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{ data: Notification[]; total: number }> {
    const { page = 1, limit = 20 } = query;

    const [data, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('通知不存在');

    notif.isRead = true;
    return this.notifRepo.save(notif);
  }
}
