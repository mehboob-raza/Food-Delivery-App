import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

export class CreateOrderDto {
  customerName!: string;
  item!: string;
  quantity!: number;
}
@Controller('orders')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.appService.createOrder(dto);
  }
}
