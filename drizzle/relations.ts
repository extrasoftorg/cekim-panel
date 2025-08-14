import { relations } from "drizzle-orm/relations";
import { users, reports, userStatusLogs, withdrawals, withdrawalTransfers } from "./schema";

export const reportsRelations = relations(reports, ({one}) => ({
	user: one(users, {
		fields: [reports.createdBy],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	reports: many(reports),
	userStatusLogs: many(userStatusLogs),
	withdrawals: many(withdrawals),
	withdrawalTransfers_transferredBy: many(withdrawalTransfers, {
		relationName: "withdrawalTransfers_transferredBy_users_id"
	}),
	withdrawalTransfers_transferredTo: many(withdrawalTransfers, {
		relationName: "withdrawalTransfers_transferredTo_users_id"
	}),
}));

export const userStatusLogsRelations = relations(userStatusLogs, ({one}) => ({
	user: one(users, {
		fields: [userStatusLogs.userId],
		references: [users.id]
	}),
}));

export const withdrawalsRelations = relations(withdrawals, ({one, many}) => ({
	user: one(users, {
		fields: [withdrawals.handlingBy],
		references: [users.id]
	}),
	withdrawalTransfers: many(withdrawalTransfers),
}));

export const withdrawalTransfersRelations = relations(withdrawalTransfers, ({one}) => ({
	user_transferredBy: one(users, {
		fields: [withdrawalTransfers.transferredBy],
		references: [users.id],
		relationName: "withdrawalTransfers_transferredBy_users_id"
	}),
	user_transferredTo: one(users, {
		fields: [withdrawalTransfers.transferredTo],
		references: [users.id],
		relationName: "withdrawalTransfers_transferredTo_users_id"
	}),
	withdrawal: one(withdrawals, {
		fields: [withdrawalTransfers.withdrawalId],
		references: [withdrawals.id]
	}),
}));