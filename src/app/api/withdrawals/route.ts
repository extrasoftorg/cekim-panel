'use server'

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/index';
import { withdrawalsTable, usersTable } from '@/db/schema';
import { eq, or, desc } from 'drizzle-orm';
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
      })
      .from(withdrawalsTable)
      .leftJoin(usersTable, eq(withdrawalsTable.handlingBy, usersTable.id))
      .where(whereCondition)
      .orderBy(desc(withdrawalsTable.concludedAt));

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
    let assignedPersonnelId = null;

    if (listLength > 0) {
      assignedPersonnelId = await redis.lpop('active_personnel');
      if (assignedPersonnelId) {
        await redis.rpush('active_personnel', assignedPersonnelId);
        await redis.set('last_assigned_personnel', assignedPersonnelId);
      }
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
      message += ` ve ${assignedUser.username} (${assignedPersonnelId}) kişisine atandı`;
    } else {
      message += ', ancak aktif çekim personeli bulunamadı';
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}