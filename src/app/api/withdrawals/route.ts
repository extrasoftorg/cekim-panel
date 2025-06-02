'use server'

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/index';
import { withdrawalsTable, usersTable, withdrawalTransfer } from '@/db/schema';
import { eq, or, desc, sql } from 'drizzle-orm';
import redis from '@/db/redis';

const withdrawalSchema = z.object({
  playerUsername: z.string().min(1),
  playerFullname: z.string().min(1),
  note: z.string().min(1),
  transactionId: z.number().int(),
  method: z.string().min(1),
  amount: z.number().positive(),
  requestedAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  message: z.string().min(1),
});

const API_KEY = process.env.API_KEY;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || '';

    const statuses = statusParam.split(',').map(s => s.trim());
    const validStatuses = ['pending', 'approved', 'rejected'] as const;
    type ValidStatus = typeof validStatuses[number];

    const filteredStatuses = statuses.filter((s): s is ValidStatus => validStatuses.includes(s as ValidStatus));

    if (filteredStatuses.length === 0) {
      return NextResponse.json({ error: 'Geçersiz veya eksik durum' }, { status: 400 });
    }

    const statusConditions = filteredStatuses.map(status => eq(withdrawalsTable.withdrawalStatus, status));
    const whereCondition = or(...statusConditions);

    const withdrawals = await db
      .select({
        id: withdrawalsTable.id,
        playerUsername: withdrawalsTable.playerUsername,
        playerFullname: withdrawalsTable.playerFullname,
        note: withdrawalsTable.note,
        transactionId: withdrawalsTable.transactionId,
        method: withdrawalsTable.method,
        amount: withdrawalsTable.amount,
        requestedAt: withdrawalsTable.requestedAt,
        concludedAt: withdrawalsTable.concludedAt,
        message: withdrawalsTable.message,
        withdrawalStatus: withdrawalsTable.withdrawalStatus,
        handlingBy: withdrawalsTable.handlingBy,
        handlerUsername: usersTable.username,
        hasTransfers: sql<boolean>`(SELECT COUNT(*) FROM withdrawal_transfers WHERE withdrawal_transfers.withdrawal_id = ${withdrawalsTable.id}) > 0`.mapWith(Boolean),
      })
      .from(withdrawalsTable)
      .leftJoin(usersTable, eq(withdrawalsTable.handlingBy, usersTable.id))
      .where(whereCondition)
      .orderBy(desc(withdrawalsTable.concludedAt));

    withdrawals.forEach(withdrawal => {
      if (withdrawal.handlingBy && !withdrawal.handlerUsername) {
        console.log(`handlingBy dolu ama handlerUsername null: withdrawalId=${withdrawal.id}, handlingBy=${withdrawal.handlingBy}`);
      }
    });

    return NextResponse.json(withdrawals);
  } catch (error) {
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== API_KEY) {
      return NextResponse.json({ error: 'Geçersiz veya eksik API anahtarı' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = withdrawalSchema.parse(body);

    const listLength = await redis.llen('active_personnel');
    let assignedPersonnelId: string | null = null;

    if (listLength > 0) {
      // Tüm listeyi al ve çevrimiçi personel bulana kadar kontrol et
      const personnelList = await redis.lrange('active_personnel', 0, -1);
      let foundOnlinePersonnel = false;

      for (let i = 0; i < personnelList.length; i++) {
        const personnelId = personnelList[i];
        const user = await db
          .select({ id: usersTable.id, role: usersTable.role, activityStatus: usersTable.activityStatus })
          .from(usersTable)
          .where(eq(usersTable.id, personnelId))
          .limit(1)
          .then(res => res[0]);

        if (user && user.role.toLowerCase() === 'cekimpersoneli' && user.activityStatus === 'online') {
          assignedPersonnelId = personnelId;
          foundOnlinePersonnel = true;

          await redis.lrem('active_personnel', 1, personnelId);
          await redis.rpush('active_personnel', personnelId);
          await redis.set('last_assigned_personnel', personnelId);
          break;
        }
      }

      if (!foundOnlinePersonnel) {
        console.log('Hiç çevrimiçi personel bulunamadı, talep boşa atanıyor.');
        assignedPersonnelId = null;
      }
    } else {
      console.log('Aktif personel listesi boş, talep boşa atanıyor.');
    }

    const newWithdrawal = await db
      .insert(withdrawalsTable)
      .values({
        playerUsername: validatedData.playerUsername,
        playerFullname: validatedData.playerFullname,
        note: validatedData.note,
        transactionId: validatedData.transactionId,
        method: validatedData.method,
        amount: validatedData.amount,
        requestedAt: new Date(validatedData.requestedAt),
        message: validatedData.message,
        withdrawalStatus: 'pending',
        handlingBy: assignedPersonnelId,
      })
      .returning();

    let message = 'Çekim talebi başarıyla oluşturuldu';
    if (assignedPersonnelId) {
      const assignedUser = await db
        .select({ username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, assignedPersonnelId))
        .limit(1)
        .then(res => res[0]);
      if (assignedUser) {
        const withdrawalId = newWithdrawal[0].id
        const redisKey = `withdrawal:assignment:${withdrawalId}`
        await redis.hset(redisKey, {
          id: assignedPersonnelId,
          playerUsername: newWithdrawal[0].playerFullname,
          transactionId: newWithdrawal[0].transactionId,
          username: assignedUser.username,
          assignedAt: new Date().toISOString(),
        })
        message += ` ve ${assignedUser.username} kişisine atandı`;
      } else {
        message += ', ancak atanan personel bulunamadı';
      }
    } else {
      message += ', ancak aktif çevrimiçi çekim personeli bulunamadı';
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}