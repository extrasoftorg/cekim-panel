import { pgTable, serial, uuid, text, varchar, timestamp, pgEnum, integer } from 'drizzle-orm/pg-core';

const roleEnum = pgEnum('role', ['admin', 'cekimSorumlusu', 'cekimPersoneli', 'spectator']); 
const activityStatusEnum = pgEnum('activity_status', ['online', 'away', 'offline']); 
const withdrawalStatusEnum = pgEnum('withdrawal_status', ['approved', 'rejected']);



export const usersTable = pgTable("users", {
    id: uuid('id').primaryKey(),                
    username: varchar('username', { length: 255 }).notNull(),  
    email: varchar('email', { length: 255 }).notNull(),      
    hashed_password: text('hashed_password').notNull(),     
    role: roleEnum('role').notNull(),            
    activity_status: activityStatusEnum('activity_status').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const withdrawalsTable = pgTable("withdrawals", {
    id: serial('id').primaryKey(),
    player_username: varchar('player_username', { length: 255 }).notNull(), 
    player_fullname: varchar('player_fullname', { length: 255 }).notNull(), 
    note: text('note').notNull(),
    transaction_id: integer('transaction_id').notNull(),
    method: varchar('method', { length: 255 }).notNull(),
    amount: integer('amount').notNull(),
    requested_at: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    concluded_at: timestamp('concluded_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    withdrawal_status: withdrawalStatusEnum('withdrawal_status').notNull(),
    message: text('message').notNull(),
});

export const userStatusLogsTable = pgTable("user_status_logs", {
    id: serial('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    activity_status: activityStatusEnum('activity_status').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
