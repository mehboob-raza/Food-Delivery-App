import { integer } from 'drizzle-orm/pg-core';
import { varchar } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
    id: uuid().defaultRandom().primaryKey(),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    item: varchar("item", { length: 100 }).notNull(),
    quantity: integer("quantity").notNull(),
});
