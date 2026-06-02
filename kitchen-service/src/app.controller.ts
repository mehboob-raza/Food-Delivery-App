import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @EventPattern('order_created')
  async handleOrderCreated(
    @Payload()
    data: {
      orderId: string;
      customerName: string;
      item: string;
      quantity: number;
    },
  ) {
    console.log('kitchen recieved order : ' + data.orderId);
    await this.appService.processOrder(data);
  }
}
