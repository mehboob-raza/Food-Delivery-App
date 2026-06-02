import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @EventPattern('order_ready')
  async handleOrderReady(
    @Payload()
    data: {
      orderId: string;
      customerName: string;
      item: string;
    },
  ) {
    console.log('Rider receive order for dispatch', data.orderId);
    await this.appService.dispatchRider(data)

  }
}
