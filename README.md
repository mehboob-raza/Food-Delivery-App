# Food Delivery Microservices

This project is a NestJS microservice-based food delivery system. It is split into three independent services that communicate asynchronously through RabbitMQ:

- `order-service` receives customer orders through an HTTP API.
- `kitchen-service` receives new order events, creates kitchen tickets, and marks orders as ready.
- `rider-service` receives ready order events and dispatches a rider.

Each service owns its own database table using Drizzle ORM with PostgreSQL/Neon. RabbitMQ is used as the message broker between services so that services do not need to call each other directly.

## Project Structure

```text
Food Delivery App/
+-- docker-compose.yml
+-- order-service/
|   +-- src/
|   |   +-- app.controller.ts
|   |   +-- app.module.ts
|   |   +-- app.service.ts
|   |   +-- db/
|   +-- drizzle/
|   +-- package.json
+-- kitchen-service/
|   +-- src/
|   |   +-- app.controller.ts
|   |   +-- app.module.ts
|   |   +-- app.service.ts
|   |   +-- db/
|   +-- drizzle/
|   +-- package.json
+-- rider-service/
    +-- src/
    |   +-- app.controller.ts
    |   +-- app.module.ts
    |   +-- app.service.ts
    |   +-- db/
    +-- drizzle/
    +-- package.json
```

## Services Overview

### Order Service

The `order-service` is the entry point for customers.

Responsibilities:

- Runs as a normal HTTP NestJS application.
- Listens on `localhost:3000` by default.
- Exposes `POST /orders`.
- Saves new orders in the `orders` table.
- Emits an `order_created` event to RabbitMQ.

Main files:

- `order-service/src/app.controller.ts`
- `order-service/src/app.service.ts`
- `order-service/src/app.module.ts`

Example request:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d "{\"customerName\":\"Ali\",\"item\":\"Pizza\",\"quantity\":2}"
```

Example response:

```json
{
  "success": true,
  "orderId": "generated-order-id"
}
```

### Kitchen Service

The `kitchen-service` is a RabbitMQ microservice.

Responsibilities:

- Listens to the `kitchen_queue`.
- Handles the `order_created` event.
- Saves the order as a kitchen ticket in the `tickets` table.
- Simulates order preparation.
- Emits an `order_ready` event to RabbitMQ.

Main files:

- `kitchen-service/src/main.ts`
- `kitchen-service/src/app.controller.ts`
- `kitchen-service/src/app.service.ts`
- `kitchen-service/src/app.module.ts`

### Rider Service

The `rider-service` is also a RabbitMQ microservice.

Responsibilities:

- Listens to the `rider_queue`.
- Handles the `order_ready` event.
- Selects a rider randomly from the local rider list.
- Saves dispatch information in the `dispatches` table.
- Logs the rider dispatch message.

Main files:

- `rider-service/src/main.ts`
- `rider-service/src/app.controller.ts`
- `rider-service/src/app.service.ts`

## RabbitMQ Explanation

RabbitMQ is a message broker. A message broker sits between services and passes messages from one service to another.

Without RabbitMQ, the order service would need to directly call the kitchen service through HTTP. Then the kitchen service might directly call the rider service. That creates tight coupling. If Kitchen is temporarily down, the order flow can fail immediately.

With RabbitMQ, services communicate through queues:

1. A producer sends a message.
2. RabbitMQ stores the message in a queue.
3. A consumer listens to that queue.
4. When the consumer is available, RabbitMQ delivers the message.
5. The consumer processes the message.

This makes the project more flexible because each service can run independently. The order service only needs to know where RabbitMQ is and which queue/event to publish to.

## RabbitMQ Usage in This Project

RabbitMQ runs from the root `docker-compose.yml` file:

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: food-delivery-rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
```

RabbitMQ ports:

- `5672` is the AMQP port used by NestJS services.
- `15672` is the RabbitMQ management dashboard.

Management dashboard:

- URL: `http://localhost:15672`
- Username: `guest`
- Password: `guest`

### Queues

This project uses two queues:

| Queue | Producer | Consumer | Purpose |
| --- | --- | --- | --- |
| `kitchen_queue` | `order-service` | `kitchen-service` | Sends new orders to the kitchen |
| `rider_queue` | `kitchen-service` | `rider-service` | Sends ready orders to rider dispatch |

### Events

This project uses two event patterns:

| Event | Sent By | Received By | Meaning |
| --- | --- | --- | --- |
| `order_created` | `order-service` | `kitchen-service` | A customer order has been created |
| `order_ready` | `kitchen-service` | `rider-service` | The kitchen has prepared the order |

### Message Flow

```text
Customer
   |
   | POST /orders
   v
Order Service
   |
   | save order in orders table
   | emit "order_created"
   v
RabbitMQ kitchen_queue
   |
   v
Kitchen Service
   |
   | save ticket in tickets table
   | prepare order
   | emit "order_ready"
   v
RabbitMQ rider_queue
   |
   v
Rider Service
   |
   | save dispatch in dispatches table
   | assign rider
   v
Order dispatched
```

## NestJS RabbitMQ Code Summary

### Order Service Producer

In `order-service/src/app.module.ts`, the order service registers a RabbitMQ client named `KITCHEN_SERVICE`.

```ts
ClientsModule.register([
  {
    name: 'KITCHEN_SERVICE',
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://guest:guest@localhost:5672'],
      queue: 'kitchen_queue',
      queueOptions: {
        durable: process.env.NODE_ENV === 'production',
      },
    },
  },
])
```

In `order-service/src/app.service.ts`, it emits the event:

```ts
this.kitchenClient.emit('order_created', {
  orderId: order.id,
  customerName: order.customerName,
  item: order.item,
  quantity: order.quantity,
});
```

### Kitchen Service Consumer and Producer

In `kitchen-service/src/main.ts`, Kitchen starts as a RabbitMQ microservice and listens to `kitchen_queue`.

In `kitchen-service/src/app.controller.ts`, it listens for the `order_created` event:

```ts
@EventPattern('order_created')
async handleOrderCreated(@Payload() data: {
  orderId: string;
  customerName: string;
  item: string;
  quantity: number;
}) {
  await this.appService.processOrder(data);
}
```

After saving a kitchen ticket, `kitchen-service/src/app.service.ts` emits `order_ready` to the rider queue:

```ts
this.riderClient.emit('order_ready', {
  orderId: data.orderId,
  customerName: data.customerName,
  item: data.item,
});
```

### Rider Service Consumer

In `rider-service/src/main.ts`, Rider starts as a RabbitMQ microservice and listens to `rider_queue`.

In `rider-service/src/app.controller.ts`, it listens for the `order_ready` event:

```ts
@EventPattern('order_ready')
async handleOrderReady(@Payload() data: {
  orderId: string;
  customerName: string;
  item: string;
}) {
  await this.appService.dispatchRider(data);
}
```

## Database Summary

Each service has its own schema and migration folder.

| Service | Table | Purpose |
| --- | --- | --- |
| `order-service` | `orders` | Stores customer orders |
| `kitchen-service` | `tickets` | Stores kitchen tickets created from orders |
| `rider-service` | `dispatches` | Stores rider dispatch records |

All services read `DATABASE_URL` from environment variables.

## Environment Variables

Each service needs a `.env` file or environment variable with:

```env
DATABASE_URL=your_postgres_or_neon_connection_string
```

The `order-service` can also use:

```env
PORT=3000
```

If `PORT` is not provided, it runs on port `3000`.

## How to Run the Project

### 1. Start RabbitMQ

From the main project folder:

```bash
docker compose up -d
```

Check the dashboard:

```text
http://localhost:15672
```

Login with:

```text
username: guest
password: guest
```

### 2. Install Dependencies

Run this inside each service folder:

```bash
cd order-service
npm install

cd ../kitchen-service
npm install

cd ../rider-service
npm install
```

### 3. Configure Database URLs

Create a `.env` file in each service folder:

```env
DATABASE_URL=your_database_connection_string
```

### 4. Run Database Migrations

Run this inside each service folder:

```bash
npm run db:migrate
```

### 5. Start Services

Open three terminals.

Terminal 1:

```bash
cd order-service
npm run start:dev
```

Terminal 2:

```bash
cd kitchen-service
npm run start:dev
```

Terminal 3:

```bash
cd rider-service
npm run start:dev
```

### 6. Create an Order

Send a request to the order service:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d "{\"customerName\":\"Ali\",\"item\":\"Burger\",\"quantity\":1}"
```

Expected behavior:

1. Order service saves the order.
2. Order service emits `order_created`.
3. Kitchen service receives the event from `kitchen_queue`.
4. Kitchen service saves a kitchen ticket.
5. Kitchen service emits `order_ready`.
6. Rider service receives the event from `rider_queue`.
7. Rider service creates a dispatch record and logs the assigned rider.

## Development Commands

Each service has the same common commands:

```bash
npm run start:dev
npm run build
npm run test
npm run lint
npm run db:generate
npm run db:migrate
```

## Important Notes

- RabbitMQ must be running before the services start.
- The services currently connect to RabbitMQ at `amqp://guest:guest@localhost:5672`.
- `order-service` is the only HTTP service in the current flow.
- `kitchen-service` and `rider-service` are message-based microservices.
- Queue durability is enabled only when `NODE_ENV` is set to `production`.
- The services use event-based communication with `emit`, so they do not wait for a response from the receiving service.

## Complete Summary

This project demonstrates a food delivery backend using NestJS microservices, RabbitMQ, Drizzle ORM, and PostgreSQL/Neon.

The order starts in `order-service` through the `POST /orders` endpoint. After saving the order, the service publishes an `order_created` event to RabbitMQ. RabbitMQ places that message into `kitchen_queue`, where `kitchen-service` receives it. The kitchen service creates a ticket, simulates preparation, and publishes an `order_ready` event to `rider_queue`. The rider service consumes that event, assigns a rider, and stores the dispatch record.

RabbitMQ is the central communication layer. It allows the services to stay independent, improves separation of responsibilities, and makes the workflow easier to scale because each service can be started, stopped, and developed separately.
