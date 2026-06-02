import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateOrderDto } from './app.controller';
import { db } from './db/db';
import { orders } from './db/schema';

@Injectable()
export class AppService {
  constructor(
    @Inject('KITCHEN_SERVICE') private readonly kitchenClient: ClientProxy,
  ) { }

  async createOrder(dto: CreateOrderDto) {
    const [order] = await db
      .insert(orders)
      .values({
        customerName: dto.customerName,
        item: dto.item,
        quantity: dto.quantity,
        status: 'pending',
      })
      .returning();
    console.log(`Order saved to Database:ID ${order.id}`);

    this.kitchenClient.emit('order_created', {
      orderId: order.id,
      customerName: order.customerName,
      item: order.item,
      quantity: order.quantity,
    });
    console.log(`Event Emitted to kitchen queue`);
    return { success: true, orderId: order.id };
  }
}
