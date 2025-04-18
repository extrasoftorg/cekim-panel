import { NextResponse } from 'next/server';
import { db } from '@/db/index';
import { usersTable, userStatusLogsTable, withdrawalsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import redis from '@/db/redis';

const updateStatusSchema = z.object({
  status: z.enum(['online', 'away', 'offline'], { message: 'Geçersiz durum' }),
  userId: z.string().uuid(),
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
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1)
      .then(res => res[0]);

    return user || null;
  } catch (error) {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    if (statusFilter) {
      const validStatuses = ['online', 'away', 'offline'];
      if (!validStatuses.includes(statusFilter)) {
        return NextResponse.json({ success: false, message: 'Geçersiz durum değeri' }, { status: 400 });
      }

      const status: 'online' | 'away' | 'offline' = statusFilter as 'online' | 'away' | 'offline';

      const filteredUsers = await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          role: usersTable.role,
          activityStatus: usersTable.activityStatus,
        })
        .from(usersTable)
        .where(eq(usersTable.activityStatus, status));

      return NextResponse.json({ success: true, data: filteredUsers });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
    }

    const userData = await db
      .select({
        id: usersTable.id,
        activityStatus: usersTable.activityStatus,
        username: usersTable.username,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    if (!userData.length) {
      return NextResponse.json({ success: false, message: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: userData[0].id,
      status: userData[0].activityStatus,
      username: userData[0].username,
      role: userData[0].role,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Bir hata oluştu' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
    }

    const body = await request.json();
    const { status, userId } = updateStatusSchema.parse(body);

    const currentUserRole = currentUser.role.toLowerCase();
    if (userId !== currentUser.id) {
      if (currentUserRole !== 'admin' && currentUserRole !== 'cekimsorumlusu') {
        return NextResponse.json({ success: false, message: 'Bu işlemi gerçekleştirmek için yetkiniz yok' }, { status: 403 });
      }
    }

    const targetUser = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then(res => res[0]);

    if (!targetUser) {
      return NextResponse.json({ success: false, message: 'Hedef kullanıcı bulunamadı' }, { status: 404 });
    }

    const targetUserRole = targetUser.role.toLowerCase();

    if (currentUserRole === 'cekimsorumlusu' && targetUserRole !== 'cekimpersoneli' && userId !== currentUser.id) {
      return NextResponse.json({ success: false, message: 'Yalnızca çekim personelinin durumunu güncelleyebilirsiniz' }, { status: 403 });
    }

    await db.transaction(async (tx) => {

      await tx
        .update(usersTable)
        .set({ activityStatus: status, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));

      await tx.insert(userStatusLogsTable).values({
        userId: userId,
        activityStatus: status,
        createdAt: new Date(),
      });

      if (targetUserRole === 'cekimpersoneli' && (status === 'away' || status === 'offline')) {
        await tx
          .update(withdrawalsTable)
          .set({
            handlingBy: null,
            handlerUsername: null,
            updatedAt: new Date(),
          })
          .where(eq(withdrawalsTable.handlingBy, userId));
      }

      if (targetUserRole === 'cekimpersoneli') {
        if (status === 'online') {
          await redis.lpush('active_personnel', userId);
        } else {
          await redis.lrem('active_personnel', 0, userId);
        }
      }
    });

    return NextResponse.json({ success: true, message: `Durum ${status} olarak güncellendi` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Bir hata oluştu' }, { status: 500 });
  }
}