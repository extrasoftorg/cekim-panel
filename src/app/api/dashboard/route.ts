"use server"

import { NextResponse } from "next/server";
import { z } from "zod";
import redis from '@/db/redis';
import { getCurrentUser } from "@/lib/auth";

const dashboardSchema = z.object({
    startDate: z.string().datetime({ message: "Geçerli bir tarih gerekli" }).optional(),
    endDate: z.string().datetime({ message: "Geçerli bir tarih gerekli" }).optional(),
});

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
            // Not: filtre devre dışı
            console.warn('Tarih filtresi Redis ile tam desteklenmiyor, tüm veriler döndürülecek.');
        }

        const globalStats = await redis.hgetall('global:statistics');
        const totalWithdrawals = parseInt(globalStats.totalWithdrawals || '0');
        const totalApproved = parseInt(globalStats.totalApproved || '0');
        const totalRejected = parseInt(globalStats.totalRejected || '0');
        const totalManuelApproved = parseInt(globalStats.totalManuelApproved || '0');
        const totalManuelRejected = parseInt(globalStats.totalManuelRejected || '0');
        const totalPaidAmount = parseFloat(globalStats.totalPaidAmount || '0');

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

        // En hızlı personel listeleri için tüm personellerin hashlerini al
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
            }
        }, { status: 200 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: 'İstatistikler alınamadı' }, { status: 500 });
    }
}