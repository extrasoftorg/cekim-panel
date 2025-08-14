import { pgTable, uniqueIndex, foreignKey, uuid, text, timestamp, unique, varchar, serial, index, jsonb, integer, doublePrecision, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const activityStatus = pgEnum("activity_status", ['online', 'away', 'offline'])
export const rejectReason = pgEnum("reject_reason", ['anapara_cevrim', 'acik_bonus_cevrim', 'acik_bahis_cevrim', 'coklu_hesap', 'ip_coklu', 'ayni_aile_coklu', 'deneme_sinir', 'call_siniri', 'promosyon_sinir', 'yatirim_sinir', 'hediye_sinir', 'bonus_sinir', 'safe_bahis', 'ozel_oyun_kontrol', 'kurma_bahis', 'casino_kurma_bahis', 'bire1_bahis', 'yatirim_bonus_suistimal', 'cashback_suistimal', 'deneme_suistimal', 'hediye_suistimal', 'yontem_sorunu', 'sekiz_saatte_cekim', 'tc_hata', 'yeni_gun', 'ikiyuztl_alt', 'on_katlari'])
export const reportStatus = pgEnum("report_status", ['pending', 'completed', 'failed'])
export const role = pgEnum("role", ['admin', 'cekimSorumlusu', 'cekimPersoneli', 'spectator'])
export const withdrawalStatus = pgEnum("withdrawal_status", ['pending', 'approved', 'rejected'])


export const reports = pgTable("reports", {
	id: uuid().primaryKey().notNull(),
	codename: text().notNull(),
	status: reportStatus().notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("reports_codename_idx").using("btree", table.codename.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "reports_created_by_fkey"
		}),
]);

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	username: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	hashedPassword: text("hashed_password").notNull(),
	role: role().notNull(),
	activityStatus: activityStatus("activity_status").default('offline').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
]);

export const userStatusLogs = pgTable("user_status_logs", {
	id: serial().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	activityStatus: activityStatus("activity_status").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_status_logs_user_id_users_id_fk"
		}),
]);

export const withdrawals = pgTable("withdrawals", {
	id: serial().primaryKey().notNull(),
	playerUsername: varchar("player_username", { length: 255 }).notNull(),
	playerFullname: varchar("player_fullname", { length: 255 }).notNull(),
	note: text().notNull(),
	additionalInfo: jsonb("additional_info"),
	rejectReason: rejectReason("reject_reason"),
	transactionId: integer("transaction_id").notNull(),
	method: varchar({ length: 255 }).notNull(),
	amount: doublePrecision().notNull(),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).notNull(),
	concludedAt: timestamp("concluded_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	withdrawalStatus: withdrawalStatus("withdrawal_status").default('pending').notNull(),
	message: text().notNull(),
	handlingBy: uuid("handling_by"),
}, (table) => [
	index("player_fullname_index").using("btree", table.playerFullname.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.handlingBy],
			foreignColumns: [users.id],
			name: "withdrawals_handling_by_users_id_fk"
		}).onDelete("set null"),
]);

export const withdrawalTransfers = pgTable("withdrawal_transfers", {
	withdrawalId: integer("withdrawal_id").notNull(),
	transferredTo: uuid("transferred_to"),
	transferredBy: uuid("transferred_by"),
	transferredAt: timestamp("transferred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("withdrawal_id_index").using("btree", table.withdrawalId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.transferredBy],
			foreignColumns: [users.id],
			name: "withdrawal_transfers_transferred_by_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.transferredTo],
			foreignColumns: [users.id],
			name: "withdrawal_transfers_transferred_to_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.withdrawalId],
			foreignColumns: [withdrawals.id],
			name: "withdrawal_transfers_withdrawal_id_withdrawals_id_fk"
		}).onDelete("cascade"),
]);
