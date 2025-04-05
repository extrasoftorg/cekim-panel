'use server'

import redis from '@/db/redis';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
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

        const token = jwt.sign(
            { userId }, 
            process.env.JWT_SECRET as string, 
            { expiresIn: '1h' } 
          );
      
            const cookieStore = await cookies()
            cookieStore.set('token', token, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 60 * 60 * 10, 
            path: '/', 
          });
        
        return { success: true, message: 'OTP doğrulandı' };

    } catch (error) {
        console.error('OTP doğrulama hatası:', error);
        return { success: false, message: 'Bir hata oluştu' };
    }
}
