'use server'

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { withdrawalsTable, usersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const transferSchema = z.object({
  withdrawalId: z.number().int(),
  newHandlerId: z.string().min(1),
});

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (!payload.userId || typeof payload.userId !== 'string') {
      return null;
    }

    const user = await db
      .select({ id: usersTable.id, role: usersTable.role, username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1)
      .then(res => res[0]);

    return user || null;
  } catch (error) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = transferSchema.parse(body);

    const withdrawal = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, validatedData.withdrawalId))
      .limit(1)
      .then(res => res[0]);

    if (!withdrawal) {
      return NextResponse.json({ success: false, message: 'Çekim talebi bulunamadı' }, { status: 404 });
    }

    const userRole = user.role.toLowerCase();

    if (validatedData.newHandlerId === 'unassign') {
      if (userRole !== 'admin' && userRole !== 'cekimsorumlusu' && !(userRole === 'cekimpersoneli' && withdrawal.handlingBy === user.id)) {
        return NextResponse.json({ success: false, message: 'Bu talebi boşa düşürmeye yetkiniz yok' }, { status: 403 });
      }

      await db
        .update(withdrawalsTable)
        .set({
          handlingBy: null,
          handlerUsername: null,
          updatedAt: new Date(),
        })
        .where(eq(withdrawalsTable.id, validatedData.withdrawalId));

      return NextResponse.json({ success: true, message: 'Talep boşa düşürüldü' });
    }

    if (userRole !== 'admin' && userRole !== 'cekimsorumlusu' && userRole !== 'cekimpersoneli') {
      return NextResponse.json({ success: false, message: 'Bu talebi transfer etmeye veya almaya yetkiniz yok' }, { status: 403 });
    }

    if (userRole === 'cekimpersoneli') {
      if (withdrawal.handlingBy === null) {
        if (validatedData.newHandlerId !== user.id) {
          return NextResponse.json({ success: false, message: 'Sadece kendi üzerinize talep alabilirsiniz' }, { status: 403 });
        }
      } else if (withdrawal.handlingBy !== user.id) {
        return NextResponse.json({ success: false, message: 'Bu talep başka bir personel tarafından alınmış, transfer yetkiniz yok' }, { status: 403 });
      }
    }

    const newHandler = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, validatedData.newHandlerId))
      .limit(1)
      .then(res => res[0]);

    if (!newHandler) {
      return NextResponse.json({ success: false, message: 'Yeni personel bulunamadı' }, { status: 404 });
    }

    await db
      .update(withdrawalsTable)
      .set({
        handlingBy: validatedData.newHandlerId,
        handlerUsername: newHandler.username,
        updatedAt: new Date(),
      })
      .where(eq(withdrawalsTable.id, validatedData.withdrawalId));

    return NextResponse.json({
      success: true,
      message: userRole === 'cekimpersoneli' && withdrawal.handlingBy === null
        ? 'Talep başarıyla alındı'
        : `Talep başarıyla ${newHandler.username} (${validatedData.newHandlerId}) kişisine transfer edildi`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Bir hata oluştu' }, { status: 500 });
  }
}