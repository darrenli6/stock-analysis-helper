import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

export const users = pgTable("user", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }).$defaultFn(() => new Date()),
  image: varchar("image", { length: 255 }),
});

export const accounts = pgTable(
  "account",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("account_user_id_idx").on(table.userId),
  ]
);

export const sessions = pgTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

export const travelTasks = pgTable(
  "travel_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userInput: text("user_input").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    destination: varchar("destination", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("idx_tasks_status").on(table.status, table.createdAt)]
);

export const travelTaskLogs = pgTable(
  "travel_task_logs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => travelTasks.id, { onDelete: "cascade" }),
    step: smallint("step").notNull().default(0),
    logType: varchar("log_type", { length: 20 }).notNull().default("log"),
    message: text("message"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_task_logs_latest").on(table.taskId, table.id)]
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const travelTasksRelations = relations(travelTasks, ({ many }) => ({
  logs: many(travelTaskLogs),
  debates: many(stockDebates),
}));

export const travelTaskLogsRelations = relations(travelTaskLogs, ({ one }) => ({
  task: one(travelTasks, {
    fields: [travelTaskLogs.taskId],
    references: [travelTasks.id],
  }),
}));

// ── 买卖方辩论 ──────────────────────────────────────────────────────────────

export const stockDebates = pgTable(
  "stock_debates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => travelTasks.id, { onDelete: "cascade" }),
    stockCode: varchar("stock_code", { length: 50 }).notNull(),
    stockName: varchar("stock_name", { length: 100 }).notNull(),
    /** running | paused | completed | failed */
    status: varchar("status", { length: 20 }).notNull().default("running"),
    totalRounds: smallint("total_rounds").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("idx_debates_task").on(table.taskId, table.createdAt)]
);

export const stockDebateMessages = pgTable(
  "stock_debate_messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    debateId: uuid("debate_id")
      .notNull()
      .references(() => stockDebates.id, { onDelete: "cascade" }),
    round: smallint("round").notNull(),
    /** bull | bear */
    side: varchar("side", { length: 10 }).notNull(),
    /** deepseek | openai */
    provider: varchar("provider", { length: 20 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_debate_messages").on(table.debateId, table.id)]
);

export const stockDebatesRelations = relations(stockDebates, ({ one, many }) => ({
  task: one(travelTasks, { fields: [stockDebates.taskId], references: [travelTasks.id] }),
  messages: many(stockDebateMessages),
}));

export const stockDebateMessagesRelations = relations(stockDebateMessages, ({ one }) => ({
  debate: one(stockDebates, { fields: [stockDebateMessages.debateId], references: [stockDebates.id] }),
}));
