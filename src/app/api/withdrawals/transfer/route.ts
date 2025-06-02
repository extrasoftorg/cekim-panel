'use server'

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { withdrawalsTable, usersTable, withdrawalTransfer } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import { alias } from 'drizzle-orm/pg-core'; 

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
      console.log("Kullanıcı oturumu bulunamadı:", user);
      return NextResponse.json({ success: false, message: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = transferSchema.parse(body);
    console.log("Transfer isteği alındı:", validatedData);

    const withdrawal = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, validatedData.withdrawalId))
      .limit(1)
      .then(res => res[0]);

    if (!withdrawal) {
      console.log("Çekim talebi bulunamadı:", validatedData.withdrawalId);
      return NextResponse.json({ success: false, message: 'Çekim talebi bulunamadı' }, { status: 404 });
    }

    const userRole = user.role.toLowerCase();

    if (validatedData.newHandlerId === 'unassign') {
      if (userRole !== 'admin' && userRole !== 'cekimsorumlusu' && !(userRole === 'cekimpersoneli' && withdrawal.handlingBy === user.id)) {
        console.log("Yetki hatası - Boşa düşürme:", { userRole, handlingBy: withdrawal.handlingBy, userId: user.id });
        return NextResponse.json({ success: false, message: 'Bu talebi boşa düşürmeye yetkiniz yok' }, { status: 403 });
      }


      await db
        .update(withdrawalsTable)
        .set({
          handlingBy: null,
          updatedAt: new Date(),
        })
        .where(eq(withdrawalsTable.id, validatedData.withdrawalId));

      await db
        .insert(withdrawalTransfer)
        .values({
          withdrawalId: validatedData.withdrawalId,
          transferredBy: user.id, // Boşa düşüren kullanıcı 
          transferredTo: null, 
          transferredAt: new Date(),
        });

      console.log("Talep boşa düşürüldü ve transfer kaydı eklendi:", validatedData.withdrawalId);
      return NextResponse.json({ success: true, message: 'Talep boşa düşürüldü' });
    }

    if (userRole !== 'admin' && userRole !== 'cekimsorumlusu' && userRole !== 'cekimpersoneli') {
      console.log("Yetki hatası - Transfer:", userRole);
      return NextResponse.json({ success: false, message: 'Bu talebi transfer etmeye veya almaya yetkiniz yok' }, { status: 403 });
    }

    if (userRole === 'cekimpersoneli') {
      if (withdrawal.handlingBy === null) {
        if (validatedData.newHandlerId !== user.id) {
          console.log("Yetki hatası - Kendi üzerine alma:", { newHandlerId: validatedData.newHandlerId, userId: user.id });
          return NextResponse.json({ success: false, message: 'Sadece kendi üzerinize talep alabilirsiniz' }, { status: 403 });
        }
      } else if (withdrawal.handlingBy !== user.id) {
        console.log("Yetki hatası - Başka personel:", { handlingBy: withdrawal.handlingBy, userId: user.id });
        return NextResponse.json({ success: false, message: 'Bu talep başka bir personel tarafından alınmış, transfer yetkiniz yok' }, { status: 403 });
      }
    }

    const newHandler = await db
      .select({ id: usersTable.id, username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, validatedData.newHandlerId))
      .limit(1)
      .then(res => res[0]);

    if (!newHandler) {
      console.log("Yeni personel bulunamadı:", validatedData.newHandlerId);
      return NextResponse.json({ success: false, message: 'Yeni personel bulunamadı' }, { status: 404 });
    }

    await db
      .update(withdrawalsTable)
      .set({
        handlingBy: validatedData.newHandlerId,
        updatedAt: new Date(),
      })
      .where(eq(withdrawalsTable.id, validatedData.withdrawalId));

    console.log("Talep güncellendi:", { withdrawalId: validatedData.withdrawalId, newHandlerId: validatedData.newHandlerId });

    // Transfer kaydını ekle
    await db
      .insert(withdrawalTransfer)
      .values({
        withdrawalId: validatedData.withdrawalId,
        transferredBy: withdrawal.handlingBy === null ? null : user.id, 
        transferredTo: validatedData.newHandlerId, 
        transferredAt: new Date(),
      });

    console.log("Transfer kaydı eklendi:", { withdrawalId: validatedData.withdrawalId, transferredTo: validatedData.newHandlerId });

    return NextResponse.json({
      success: true,
      message: userRole === 'cekimpersoneli' && withdrawal.handlingBy === null
        ? 'Talep başarıyla alındı'
        : `Talep başarıyla ${newHandler.username} kişisine transfer edildi`
    });
  } catch (error) {
    console.error("Transfer işlemi sırasında hata:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Bir hata oluştu' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withdrawalId = parseInt(searchParams.get('withdrawalId') || '', 10);

    if (isNaN(withdrawalId)) {
      return NextResponse.json({ success: false, message: 'Geçersiz veya eksik çekim talebi ID' }, { status: 400 });
    }

    const transferredByUsers = alias(usersTable, 'transferredByUsers');
    const transferredToUsers = alias(usersTable, 'transferredToUsers');

    const transfers = await db
      .select({
        transferredAt: withdrawalTransfer.transferredAt,
        transferredByUsername: transferredByUsers.username,
        transferredToUsername: transferredToUsers.username,
      })
      .from(withdrawalTransfer)
      .leftJoin(transferredByUsers, eq(withdrawalTransfer.transferredBy, transferredByUsers.id))
      .leftJoin(transferredToUsers, eq(withdrawalTransfer.transferredTo, transferredToUsers.id))
      .where(eq(withdrawalTransfer.withdrawalId, withdrawalId))
      .orderBy(withdrawalTransfer.transferredAt);

    const transferData = transfers.map(transfer => ({
      transferredByUsername: transfer.transferredByUsername || 'Boştan Alındı', 
      transferredToUsername: transfer.transferredToUsername || 'Boşa Düşürüldü', 
      transferredAt: transfer.transferredAt,
    }));

    return NextResponse.json({
      success: true,
      data: transferData,
    });
  } catch (error) {
    console.error('Transfer geçmişi çekilirken hata oluştu:', error);
    return NextResponse.json({ success: false, message: 'Bir hata oluştu' }, { status: 500 });
  }
}