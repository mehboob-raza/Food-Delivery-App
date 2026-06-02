import { Injectable } from '@nestjs/common';
import { db } from './db/db';
import { dispatches } from './db/schema';

const RIDERS = ['ALIYAR', 'HASSAN', 'ALYAN', 'HAMZA']
@Injectable()
export class AppService {
  async dispatchRider(data: {
    orderId: string;
    customerName: string;
    item: string;
  }) {
    const rider = RIDERS[Math.floor(Math.random() * RIDERS.length)];
    const [dispatch] = await db
      .insert(dispatches)
      .values({
        orderId: data.orderId,
        customerName: data.customerName,
        item: data.item,
        riderStatus: 'dispatched',
      })
      .returning();
    console.log('Order is dispatched', dispatch.id);
    console.log(
      `${rider} is on the way to your location, with your item ${dispatch.item} , for customer ${dispatch.customerName}`,
    );
  }
}
