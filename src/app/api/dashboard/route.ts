"use server"

import { NextResponse } from "next/server";
import { z } from "zod";
import redis from '@/db/redis';
import { getCurrentUser } from "@/lib/auth";
import { db } from '@/db';
import { withdrawalsTable, usersTable } from '@/db/schema';
import { eq, and, gte, lte, isNotNull, sql, ne, like } from 'drizzle-orm';

const dashboardSchema = z.object({
    startDate: z.string().datetime({ message: "Geçerli bir tarih gerekli" }).optional(),
    endDate: z.string().datetime({ message: "Geçerli bir tarih gerekli" }).optional(),
});

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;


        // Tarih filtresi kontrolü
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);


            if (start > end) {
                return NextResponse.json({ success: false, error: 'Başlangıç tarihi bitiş tarihinden sonra olamaz' }, { status: 400 });
            }
            
            // Tarih filtresi varsa PostgreSQL'den hesapla
            return await getStatsFromPostgreSQL(start, end);
        } else {
            // Tarih filtresi yoksa Redis'ten al (mevcut hızlı yöntem)
            return await getStatsFromRedis();
        }

    } catch (error) {
        console.error('API Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
        }
        return NextResponse.json({ 
            success: false, 
            error: 'İstatistikler alınamadı',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Redis'ten istatistikleri al (mevcut hızlı yöntem)
async function getStatsFromRedis() {
    const globalStats = await redis.hgetall('global:statistics');
    const totalWithdrawals = parseInt(globalStats.totalWithdrawals || '0');
    const totalApproved = parseInt(globalStats.totalApproved || '0');
    const totalRejected = parseInt(globalStats.totalRejected || '0');
    const totalManuelApproved = parseInt(globalStats.totalManuelApproved || '0');
    const totalManuelRejected = parseInt(globalStats.totalManuelRejected || '0');
    const totalPaidAmount = parseFloat(globalStats.totalPaidAmount || '0');

    const botStats = await redis.hgetall(`user:bbe5c3c2-812d-4795-a87b-e01b859e13e4:statistics`);
    const botApproved = parseInt(botStats.approved || '0');
    const botRejected = parseInt(botStats.rejected || '0');

    const approvalRate = totalWithdrawals > 0 ? (totalApproved / totalWithdrawals) * 100 : 0;

    const rejectReasonKeys = await redis.keys('global:rejectReason:*');
    const rejectReasonsStats: { [key: string]: { count: number; totalAmount: number } } = {};

    for (const key of rejectReasonKeys) {
        const stats = await redis.hgetall(key);
        const reason = key.split(':')[2]; 
        rejectReasonsStats[reason] = {
            count: parseInt(stats.count || '0'),
            totalAmount: parseFloat(stats.totalAmount || '0'),
        };
    }

    const userKeys = await redis.keys('user:*:statistics');
    const fastestApprovers = [];
    const fastestRejecters = [];

    for (const key of userKeys) {
        const stats = await redis.hgetall(key);
        const approved = parseInt(stats.approved || '0') + parseInt(stats.manualApproved || '0');
        const rejected = parseInt(stats.rejected || '0') + parseInt(stats.manualRejected || '0');
        const avgApprovalDuration = parseFloat(stats.avgApprovalDuration || '0');
        const avgRejectionDuration = parseFloat(stats.avgRejectionDuration || '0');
        const handlerUsername = stats.handlerUsername || key.split(':')[1];

        // En hızlı onay verenler
        if (approved > 0 && avgApprovalDuration > 0) {
            fastestApprovers.push({
                handlerUsername,
                avgApprovalDuration,
            });
        }

        // En hızlı ret verenler
        if (rejected > 0 && avgRejectionDuration > 0) {
            fastestRejecters.push({
                handlerUsername,
                avgRejectionDuration,
            });
        }
    }

    fastestApprovers.sort((a, b) => a.avgApprovalDuration - b.avgApprovalDuration).slice(0, 5);
    fastestRejecters.sort((a, b) => a.avgRejectionDuration - b.avgRejectionDuration).slice(0, 5);

    return NextResponse.json({
        success: true,
        data: {
            totalWithdrawals,
            totalApproved,
            totalRejected,
            totalManuelApproved,
            totalManuelRejected,
            totalPaidAmount,
            approvalRate,
            fastestApprovers,
            fastestRejecters,
            rejectReasonsStats,
            botApproved,
            botRejected,
        }
    }, { status: 200 });
}

async function getStatsFromPostgreSQL(startDate: Date, endDate: Date) {
    const BOT_USER_ID = 'bbe5c3c2-812d-4795-a87b-e01b859e13e4';
    
    
    const dateFilter = and(
        gte(withdrawalsTable.requestedAt, startDate),
        lte(withdrawalsTable.requestedAt, endDate)
    );


    const basicStats = await db
        .select({
            totalWithdrawals: sql<number>`count(*)`,
            totalApproved: sql<number>`count(*) filter (where withdrawal_status = 'approved')`,
            totalRejected: sql<number>`count(*) filter (where withdrawal_status = 'rejected')`,
            totalPaidAmount: sql<number>`sum(amount) filter (where withdrawal_status = 'approved')`,
        })
        .from(withdrawalsTable)
        .where(dateFilter);

    const manuelStats = await db
        .select({
            totalManuelApproved: sql<number>`count(*) filter (where withdrawal_status = 'approved' and note like '%MANUEL - ONAY')`,
            totalManuelRejected: sql<number>`count(*) filter (where withdrawal_status = 'rejected' and note like '%MANUEL - RET')`,
        })
        .from(withdrawalsTable)
        .where(dateFilter);

    const botStats = await db
        .select({
            botApproved: sql<number>`count(*) filter (where withdrawal_status = 'approved' and handling_by = ${BOT_USER_ID})`,
            botRejected: sql<number>`count(*) filter (where withdrawal_status = 'rejected' and handling_by = ${BOT_USER_ID})`,
        })
        .from(withdrawalsTable)
        .where(dateFilter);

    const rejectReasonsData = await db
        .select({
            rejectReason: withdrawalsTable.rejectReason,
            count: sql<number>`count(*)`,
            totalAmount: sql<number>`sum(amount)`,
        })
        .from(withdrawalsTable)
        .where(and(
            dateFilter,
            eq(withdrawalsTable.withdrawalStatus, 'rejected'),
            isNotNull(withdrawalsTable.rejectReason)
        ))
        .groupBy(withdrawalsTable.rejectReason);

    const rejectReasonsStats: { [key: string]: { count: number; totalAmount: number } } = {};
    rejectReasonsData.forEach(item => {
        if (item.rejectReason) {
            rejectReasonsStats[item.rejectReason] = {
                count: item.count,
                totalAmount: item.totalAmount || 0,
            };
        }
    });

    
    const userStats = await db
        .select({
            handlerId: withdrawalsTable.handlingBy,
            handlerUsername: usersTable.username,
            withdrawalStatus: withdrawalsTable.withdrawalStatus,
            durationMinutes: sql<number>`EXTRACT(EPOCH FROM (concluded_at - requested_at)) / 60`,
        })
        .from(withdrawalsTable)
        .leftJoin(usersTable, eq(withdrawalsTable.handlingBy, usersTable.id))
        .where(and(
            dateFilter,
            ne(withdrawalsTable.handlingBy, BOT_USER_ID),
            isNotNull(withdrawalsTable.handlingBy)
        ));

    const userAverages: { [key: string]: { 
        username: string; 
        approvalDurations: number[]; 
        rejectionDurations: number[]; 
    } } = {};

    userStats.forEach(stat => {
        if (!stat.handlerId || !stat.handlerUsername) return;
        
        const userId = stat.handlerId;
        if (!userAverages[userId]) {
            userAverages[userId] = {
                username: stat.handlerUsername,
                approvalDurations: [],
                rejectionDurations: [],
            };
        }

        if (stat.withdrawalStatus === 'approved' && stat.durationMinutes && stat.durationMinutes > 0 && !isNaN(stat.durationMinutes)) {
            userAverages[userId].approvalDurations.push(stat.durationMinutes);
        } else if (stat.withdrawalStatus === 'rejected' && stat.durationMinutes && stat.durationMinutes > 0 && !isNaN(stat.durationMinutes)) {
            userAverages[userId].rejectionDurations.push(stat.durationMinutes);
        }
    });

    const fastestApprovers: { handlerUsername: string; avgApprovalDuration: number }[] = [];
    const fastestRejecters: { handlerUsername: string; avgRejectionDuration: number }[] = [];

    Object.values(userAverages).forEach(user => {
        if (user.approvalDurations.length > 0) {
            const avgApprovalDuration = user.approvalDurations.reduce((a, b) => Number(a) + Number(b), 0) / user.approvalDurations.length;
            fastestApprovers.push({
                handlerUsername: user.username,
                avgApprovalDuration: Math.round(avgApprovalDuration * 100) / 100,
            });
        }

        if (user.rejectionDurations.length > 0) {
            const avgRejectionDuration = user.rejectionDurations.reduce((a, b) => Number(a) + Number(b), 0) / user.rejectionDurations.length;
            fastestRejecters.push({
                handlerUsername: user.username,
                avgRejectionDuration: Math.round(avgRejectionDuration * 100) / 100,
            });
        }
    });

    fastestApprovers.sort((a, b) => a.avgApprovalDuration - b.avgApprovalDuration);
    fastestRejecters.sort((a, b) => a.avgRejectionDuration - b.avgRejectionDuration);
    
    

    const stats = basicStats[0];
    const manuel = manuelStats[0];
    const bot = botStats[0];

    const totalWithdrawals = stats.totalWithdrawals || 0;
    const totalApproved = stats.totalApproved || 0;
    const totalRejected = stats.totalRejected || 0;
    const totalPaidAmount = stats.totalPaidAmount || 0;
    const approvalRate = totalWithdrawals > 0 ? (totalApproved / totalWithdrawals) * 100 : 0;

    return NextResponse.json({
        success: true,
        data: {
            totalWithdrawals,
            totalApproved,
            totalRejected,
            totalManuelApproved: manuel.totalManuelApproved || 0,
            totalManuelRejected: manuel.totalManuelRejected || 0,
            totalPaidAmount,
            approvalRate,
            fastestApprovers,
            fastestRejecters,
            rejectReasonsStats,
            botApproved: bot.botApproved || 0,
            botRejected: bot.botRejected || 0,
        }
    }, { status: 200 });
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
        }

        const body = await request.json();
        const { startDate, endDate } = dashboardSchema.parse(body);

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start > end) {
                return NextResponse.json({ success: false, error: 'Başlangıç tarihi bitiş tarihinden sonra olamaz' }, { status: 400 });
            }
            
            return await getStatsFromPostgreSQL(start, end);
        } else {
            return await getStatsFromRedis();
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: 'İstatistikler alınamadı' }, { status: 500 });
    }
}