'use server'

import redis from '@/db/redis';
import { redirect } from 'next/navigation';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

export async function verifyOtp(userId: string, inputOtp: string) {
    try {
        const storedOtp = await redis.get(`otp:${userId}`);
        console.log(storedOtp)

        if (!storedOtp) {
            return { success: false, message: 'OTP bulunamadı veya süresi doldu' };
        }

        if (storedOtp !== inputOtp) {
            return { success: false, message: 'Geçersiz OTP' };
        }

        await redis.del(`otp:${userId}`);

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const token = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('10h')
        .sign(secret);

        const cookieStore = await cookies()
        cookieStore.set('token', token, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 60 * 60 * 10,
            path: '/',
        });

        return { success: true, message: 'OTP doğrulandı' };

    } catch (error) {
        console.error('OTP doğrulama hatası:', error);
        return { success: false, message: 'Bir hata oluştu' };
    }
}
