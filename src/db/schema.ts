import { pgTable, serial, uuid, text, varchar, timestamp, pgEnum, integer, doublePrecision, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { table } from 'console';

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

const rejectReasonEnum = pgEnum('reject_reason', [
    'anapara_cevrim',
    'acik_bonus_cevrim',
    'acik_bahis_cevrim',
    'coklu_hesap',
    'ip_coklu',
    'ayni_aile_coklu',
    'deneme_sinir',
    'call_siniri',
    'promosyon_sinir',
    'yatirim_sinir',
    'hediye_sinir',
    'bonus_sinir',
    'safe_bahis',
    'ozel_oyun_kontrol',
    'kurma_bahis',
    'casino_kurma_bahis',
    'bire1_bahis',
    'yatirim_bonus_suistimal',
    'cashback_suistimal',
    'deneme_suistimal',
    'hediye_suistimal',
    'yontem_sorunu',
    'sekiz_saatte_cekim',
    'tc_hata',
    'yeni_gun',
    'ikiyuztl_alt',
    'on_katlari',
])

export const reportStatusEnum = pgEnum('report_status', ['pending', 'completed', 'failed'])

export const reportsTable = pgTable('reports', {
    id: uuid('id').primaryKey(),
    codename: text('codename').notNull(),
    status: reportStatusEnum('status').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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
    additionalInfo: jsonb('additional_info'),
    rejectReason: rejectReasonEnum('reject_reason'),
    transactionId: integer('transaction_id').notNull(),
    method: varchar('method', { length: 255 }).notNull(),
    amount: doublePrecision('amount').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    concludedAt: timestamp('concluded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    withdrawalStatus: withdrawalStatusEnum('withdrawal_status').notNull().default('pending'),
    message: text('message').notNull(),
    handlingBy: uuid('handling_by').references(() => usersTable.id, { onDelete: 'set null' }),
    assignedTo: uuid('assigned_to').references(() => usersTable.id, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
}, (table) => {
    return {
        playerUsernameIndex: index('player_fullname_index').on(table.playerFullname),
    }
})

export const userStatusLogsTable = pgTable("user_status_logs", {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => usersTable.id),
    activityStatus: activityStatusEnum('activity_status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const withdrawalTransfer = pgTable("withdrawal_transfers", {
    withdrawalId: integer('withdrawal_id').notNull().references(() => withdrawalsTable.id, { onDelete: 'cascade' }),
    transferredTo: uuid('transferred_to').references(() => usersTable.id, { onDelete: 'set null' }),
    transferredBy: uuid('transferred_by').references(() => usersTable.id, { onDelete: 'set null' }),
    transferredAt: timestamp('transferred_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => {
    return {
        withdrawalIdIndex: index('withdrawal_id_index').on(table.withdrawalId),
    };
});

export const withdrawalsRelations = relations(withdrawalsTable, ({ one, many }) => ({
    handler: one(usersTable, {
        fields: [withdrawalsTable.handlingBy],
        references: [usersTable.id],
    }),
    withdrawalTransfers: many(withdrawalTransfer),
}));


export const usersRelations = relations(usersTable, ({ many }) => ({
    withdrawals: many(withdrawalsTable),
    withdrawalTransfers: many(withdrawalTransfer, {
        relationName: 'user',
    }),
    transferredByTransfers: many(withdrawalTransfer, {
        relationName: 'transferredBy',
    }),
}));

export const withdrawalTransferRelations = relations(withdrawalTransfer, ({ one }) => ({
    withdrawal: one(withdrawalsTable, {
        fields: [withdrawalTransfer.withdrawalId],
        references: [withdrawalsTable.id],
    }),
    user: one(usersTable, {
        fields: [withdrawalTransfer.transferredTo],
        references: [usersTable.id],
        relationName: 'user',
    }),
    transferredBy: one(usersTable, {
        fields: [withdrawalTransfer.transferredBy],
        references: [usersTable.id],
        relationName: 'transferredBy',
    }),
}));