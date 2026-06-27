import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Define the 'users' table.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workflowDefinitions = pgTable('workflow_definitions', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  name: text('name').notNull(),
  nodes: jsonb('nodes').notNull(),
  edges: jsonb('edges').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const executionLogs = pgTable('execution_logs', {
  id: serial('id').primaryKey(),
  workflowId: integer('workflow_id').references(() => workflowDefinitions.id).notNull(),
  status: text('status').notNull(),
  logData: jsonb('log_data'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const artifacts = pgTable('artifacts', {
  id: serial('id').primaryKey(),
  executionId: integer('execution_id').references(() => executionLogs.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
