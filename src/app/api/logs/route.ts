"use server"
import { NextResponse } from "next/server"
import { db } from '@/db/index';
import { eq, desc, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { userStatusLogsTable, usersTable, withdrawalsTable } from '@/db/schema';
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, message: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
        }

        const userStatusLogs = await db
            .select({
                id: userStatusLogsTable.id,
                userId: userStatusLogsTable.userId,
                username: usersTable.username,
                activityStatus: userStatusLogsTable.activityStatus,
                createdAt: userStatusLogsTable.createdAt,
            })
            .from(userStatusLogsTable)
            .leftJoin(usersTable, eq(userStatusLogsTable.userId, usersTable.id))
            .orderBy(desc(userStatusLogsTable.createdAt))

        const assignedToUser = alias(usersTable, 'assignedToUser');
        const withdrawalAssignmentLogs = await db
            .select({
                withdrawalId: withdrawalsTable.id,
                transactionId: withdrawalsTable.transactionId,
                playerFullname: withdrawalsTable.playerFullname,
                type: sql`'assignment'`.as('type'),
                assignedTo: assignedToUser.username,
                assignedAt: withdrawalsTable.assignedAt,
                details: sql`${withdrawalsTable.playerFullname} || ' kullanıcının ' || ${withdrawalsTable.transactionId} || ' IDli talebi ' || ${assignedToUser.username} || ' kisisine atandi.'`.as('details')
            })
            .from(withdrawalsTable)
            .leftJoin(assignedToUser, eq(withdrawalsTable.assignedTo, assignedToUser.id))
            .where(isNotNull(withdrawalsTable.assignedTo))
            .orderBy(desc(withdrawalsTable.assignedAt))

        const concludedByUser = alias(usersTable, 'concludedByUser');
        const withdrawalConcludeLogs = await db
            .select({
                withdrawalId: withdrawalsTable.id,
                transactionId: withdrawalsTable.transactionId,
                playerFullname: withdrawalsTable.playerFullname,
                type: sql`'conclude'`.as('type'),
                concludeBy: concludedByUser.username,
                concludedAt: withdrawalsTable.concludedAt,
                result: withdrawalsTable.withdrawalStatus,
                details: sql`${withdrawalsTable.playerFullname} || ' kullanıcının ' || ${withdrawalsTable.transactionId} || ' IDli talebi ' || ${concludedByUser.username} || ' tarafindan ' || 
                    CASE WHEN ${withdrawalsTable.withdrawalStatus} = 'approved' THEN 'onaylandi' ELSE 'reddedildi' END || '.'`.as('details')
            })
            .from(withdrawalsTable)
            .leftJoin(concludedByUser, eq(withdrawalsTable.handlingBy, concludedByUser.id))
            .where(isNotNull(withdrawalsTable.concludedAt))
            .orderBy(desc(withdrawalsTable.concludedAt))

        const allLogs = [
            ...userStatusLogs.map(log => ({
                type: 'status',
                userId: log.userId,
                username: log.username,
                activityStatus: log.activityStatus,
                timestamp: log.createdAt
                    ? (log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt).toISOString())
                    : new Date().toISOString(),
                details: `Durumu ${log.activityStatus === 'online' ? 'Çevrimiçi' : log.activityStatus === 'away' ? 'Mola' : 'Çevrimdışı'} olarak güncellendi.`,
            })),
            ...withdrawalAssignmentLogs.map(log => ({
                ...log,
                timestamp: log.assignedAt ? new Date(log.assignedAt).toISOString() : new Date().toISOString(),
            })),
            ...withdrawalConcludeLogs.map(log => ({
                ...log,
                timestamp: log.concludedAt ? new Date(log.concludedAt).toISOString() : new Date().toISOString(),
            })),
        ].sort((a, b) => {
            const timestampA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timestampB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timestampB - timestampA;
        });

        if (allLogs.length === 0) {
            return NextResponse.json({ success: false, error: 'Hiç log kaydı bulunamadı' }, { status: 200 });
        }

        return NextResponse.json({ success: true, data: allLogs }, { status: 200 });

    } catch (error) {
        console.error("Loglar alınamadı:", error);
        return NextResponse.json({ success: false, error: "Loglar alınamadı" }, { status: 500 });
    }
}