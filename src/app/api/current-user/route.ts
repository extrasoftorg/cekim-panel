'use server'

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { db } from '@/db';
import { usersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getCurrentUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
        console.error('Token bulunamadı');
        return null;
    }

    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        if (!payload.userId || typeof payload.userId !== 'string') {
            console.error('Geçersiz payload: userId eksik veya yanlış türde');
            return null;
        }

        const user = await db
            .select({ id: usersTable.id, role: usersTable.role, username: usersTable.username })
            .from(usersTable)
            .where(eq(usersTable.id, payload.userId))
            .limit(1)
            .then(res => res[0]);

        if (!user) {
            console.error('Kullanıcı bulunamadı:', payload.userId);
            return null;
        }

        return { id: user.id, role: user.role, username: user.username };
    } catch (error) {
        console.error('JWT doğrulama hatası:', error);
        return null;
    }
}

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, message: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        console.error('Kullanıcı alma hatası:', error);
        return NextResponse.json({ success: false, message: 'Bir hata oluştu' }, { status: 500 });
    }
}