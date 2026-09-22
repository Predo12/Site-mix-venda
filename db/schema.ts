import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    fulfillmentType: text("fulfillment_type").notNull(),
    cep: text("cep"),
    street: text("street"),
    streetNumber: text("street_number"),
    complement: text("complement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    itemsJson: text("items_json").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    paymentMethod: text("payment_method").notNull(),
    paymentFeeCents: integer("payment_fee_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    notes: text("notes"),
    ageConfirmed: integer("age_confirmed", { mode: "boolean" }).notNull().default(false),
    ageConfirmedAt: integer("age_confirmed_at", { mode: "timestamp_ms" }),
    status: text("status").notNull().default("new"),
    etaMin: integer("eta_min").notNull().default(40),
    etaMax: integer("eta_max").notNull().default(60),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_orders_order_number").on(table.orderNumber),
    index("idx_orders_status_created").on(table.status, table.createdAt),
  ],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_order_events_order").on(table.orderId, table.createdAt)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    accessToken: text("access_token").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    status: text("status").notNull().default("open"),
    assignedTo: text("assigned_to"),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_conversations_token").on(table.accessToken),
    index("idx_conversations_status_last").on(table.status, table.lastMessageAt),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id").notNull(),
    senderType: text("sender_type").notNull(),
    senderName: text("sender_name").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_messages_conversation").on(table.conversationId, table.createdAt)],
);

export const staff = sqliteTable(
  "staff",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("idx_staff_email").on(table.email)],
);

export const deliveryZones = sqliteTable(
  "delivery_zones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    neighborhood: text("neighborhood").notNull(),
    feeCents: integer("fee_cents").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("idx_delivery_zones_neighborhood").on(table.neighborhood)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
