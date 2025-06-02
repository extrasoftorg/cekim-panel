"use server"
import { NextResponse } from "next/server"
import { db } from '@/db/index';
import { eq, desc } from 'drizzle-orm';
import { userStatusLogsTable, usersTable } from '@/db/schema';
import redis from "@/db/redis"
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

        const keys = await redis.keys("withdrawal:assignment:*")
        const withdrawalLogs = []
        if (keys && keys.length > 0) {
            for (const key of keys) {
                const data = await redis.hgetall(key)
                const withdrawalId = key.split(":").pop()

                // Talep atama data
                if (data.id && data.username && data.assignedAt && data.playerUsername && data.transactionId) {
                    const assignedAt = data.assignedAt
                        ? new Date(data.assignedAt).toISOString() 
                        : new Date().toISOString();
                    withdrawalLogs.push({
                        withdrawalId,
                        transactionId: data.transactionId,
                        playerUsername: data.playerUsername,
                        type: 'assignment',
                        assignedTo: data.username,
                        assignedAt: assignedAt,
                        details: `${data.playerUsername} Kullanıcının ${data.transactionId} ID'li talebi ${data.username} kişisine atandı.`
                    })
                }

                // Talep sonucu data
                if (data.concludedBy && data.concludedByUsername && data.result && data.concludedAt && data.playerUsername && data.transactionId) {
                    const concludedAt = data.concludedAt
                        ? new Date(data.concludedAt).toISOString() 
                        : new Date().toISOString();
                    withdrawalLogs.push({
                        withdrawalId,
                        transactionId: data.transactionId,
                        playerUsername: data.playerUsername,
                        type: 'conclude',
                        concludeBy: data.concludedByUsername,
                        concludedAt: concludedAt,
                        result: data.result,
                        details: `${data.playerUsername} Kullanıcının ${data.transactionId} ID'li talebi ${data.concludedByUsername} tarafından ${data.result === 'approved' ? 'onaylandı' : 'reddedildi'}.`
                    })
                }
            }
        }

        const allLogs = [
            ...userStatusLogs.map(log => ({
                type: 'status',
                userId: log.userId,
                username: log.username,
                activityStatus: log.activityStatus,
                timestamp: log.createdAt
                    ? (log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt).toISOString()) // +3 saat eklemeden UTC
                    : new Date().toISOString(),
                details: `Durumu ${log.activityStatus === 'online' ? 'Çevrimiçi' : log.activityStatus === 'away' ? 'Mola' : 'Çevrimdışı'} olarak güncellendi.`,
            })),
            ...withdrawalLogs.map(log => ({
                ...log,
                timestamp: log.assignedAt || log.concludedAt || new Date().toISOString(),
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