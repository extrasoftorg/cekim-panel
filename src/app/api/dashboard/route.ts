"use server"

import { NextResponse } from "next/server";
import { z } from "zod";
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
            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            
            return await getStatsFromPostgreSQL(startOfDay, endOfDay);
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
            // Tarih filtresi yoksa bugünün verilerini PostgreSQL'den al
            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            
            return await getStatsFromPostgreSQL(startOfDay, endOfDay);
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: 'İstatistikler alınamadı' }, { status: 500 });
    }
}