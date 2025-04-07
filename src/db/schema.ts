import { pgTable, serial, uuid, text, varchar, timestamp, pgEnum, integer, doublePrecision } from 'drizzle-orm/pg-core';


const roleEnum = pgEnum('role', [
    'admin', 
    'cekimSorumlusu', 
    'cekimPersoneli', 
    'spectator'
]); 

const activityStatusEnum = pgEnum('activity_status', [
    'online', 
    'away', 
    'offline'
]); 

const withdrawalStatusEnum = pgEnum('withdrawal_status', [
    'pending',
    'approved',
    'rejected',
]);



export const usersTable = pgTable("users", {
    id: uuid('id').primaryKey(),                
    username: varchar('username', { length: 255 }).notNull().unique(),  
    email: varchar('email', { length: 255 }).notNull().unique(),      
    hashedPassword: text('hashed_password').notNull(),     
    role: roleEnum('role').notNull(),            
    activityStatus: activityStatusEnum('activity_status').notNull().default('offline'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const withdrawalsTable = pgTable("withdrawals", {
    id: serial('id').primaryKey(),
    playerUsername: varchar('player_username', { length: 255 }).notNull(), 
    playerFullname: varchar('player_fullname', { length: 255 }).notNull(), 
    note: text('note').notNull(),
    transactionId: integer('transaction_id').notNull(),
    method: varchar('method', { length: 255 }).notNull(),
    amount: doublePrecision('amount').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    concludedAt: timestamp('concluded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    withdrawalStatus: withdrawalStatusEnum('withdrawal_status').notNull().default('pending'),
    message: text('message').notNull(),
});

export const userStatusLogsTable = pgTable("user_status_logs", {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => usersTable.id),
    activityStatus: activityStatusEnum('activity_status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
