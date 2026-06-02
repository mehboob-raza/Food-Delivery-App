import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { db } from './db/db';
import { tickets } from './db/schema';

@Injectable()
export class AppService {
  @Inject('RIDER_SERVICE') private readonly riderClient!: ClientProxy;
  async processOrder(data: {
    orderId: string;
    customerName: string;
    item: string;
    quantity: number;
  }) {
    const [ticket] = await db
      .insert(tickets)
      .values({ 
        orderId: data.orderId,
        customerName: data.customerName,
        item: data.item,
        status: 'received',
      })
      .returning();

    console.log('Ticket saved into Kitchen DB', ticket.id);
    await new Promise((res) => setTimeout(res, 2000));

    this.riderClient.emit('order_ready', {
      orderId: data.orderId,
      customerName: data.customerName,
      item: data.item,
    });

    console.log(
      'Event Emitted to rider queue, and order ready-to-deliver',
      ticket.id,
    );
  }
}
