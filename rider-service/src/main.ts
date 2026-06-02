import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        url: ['amqp://guest:guest@localhost:5672'],
        queue: 'rider_queue',
        queueOptions: {
          durable: process.env.NODE_ENV === 'production',
        },
      },
    });
  await app.listen();
  console.log('Rider service is listening on rider queue');
}
void bootstrap();
