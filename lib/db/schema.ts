import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  uuid
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('LEARNER'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  status: varchar('status', { length: 20 }),
  mode: varchar('mode', { length: 10 }).notNull().default('test'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const learningModules = pgTable('learning_modules', {
  id: serial('id').primaryKey(),
  sourceModuleId: uuid('source_module_id').notNull(),
  environment: varchar('environment', { length: 10 })
    .notNull()
    .default('staging'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  title: varchar('title', { length: 200 }).notNull(),
  summary: text('summary'),
  bodyMarkdown: text('body_markdown').notNull(),
  checklistJson: jsonb('checklist_json').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id')
    .notNull()
    .references(() => users.id),
  actorRole: varchar('actor_role', { length: 20 }).notNull(),
  environment: varchar('environment', { length: 10 }).notNull(),
  actionType: varchar('action_type', { length: 40 }).notNull(),
  changedEntityIdsJson: jsonb('changed_entity_ids_json').notNull(),
  diffSummary: text('diff_summary').notNull(),
  diffJson: jsonb('diff_json').notNull(),
  evaluationJson: jsonb('evaluation_json').notNull(),
  rationale: text('rationale').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  commitHash: varchar('commit_hash', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  actorRole: varchar('actor_role', { length: 20 }),
  action: text('action').notNull(),
  entityType: varchar('entity_type', { length: 40 }),
  entityId: text('entity_id'),
  environment: varchar('environment', { length: 10 }),
  success: boolean('success').notNull().default(true),
  detailsJson: jsonb('details_json'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const learningModulesRelations = relations(learningModules, () => ({}));

export const runsRelations = relations(runs, ({ one }) => ({
  actor: one(users, {
    fields: [runs.actorUserId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type LearningModule = typeof learningModules.$inferSelect;
export type NewLearningModule = typeof learningModules.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export enum AuditAction {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_MODULE = 'CREATE_MODULE',
  UPDATE_MODULE = 'UPDATE_MODULE',
  CREATE_RUN = 'CREATE_RUN',
  PROPOSE_RUN = 'PROPOSE_RUN',
  APPROVE_RUN = 'APPROVE_RUN',
  REJECT_RUN = 'REJECT_RUN',
  PROMOTE_RUN = 'PROMOTE_RUN',
  STRIPE_CHECKOUT_SUCCESS = 'STRIPE_CHECKOUT_SUCCESS',
  STRIPE_CHECKOUT_FAILURE = 'STRIPE_CHECKOUT_FAILURE',
  STRIPE_WEBHOOK_FAILURE = 'STRIPE_WEBHOOK_FAILURE',
  ACCESS_DENIED = 'ACCESS_DENIED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}
