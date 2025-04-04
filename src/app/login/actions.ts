'use server'
import { db } from '@/db/index'
import { usersTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt' 
import redis from '@/db/redis'
import crypto from 'crypto'
 
export async function login(username: string, password: string) {
    try {
        const user = await db.select ({
            id: usersTable.id,
            username: usersTable.username,
            hashedPassword: usersTable.hashedPassword,
            email: usersTable.email
        })
        .from(usersTable)
        .where(eq(usersTable.username, username))
        .limit(1)

        if(!user.length) {
            return { success: false, message: 'Kullanıcı bulunamadı' }
        }

        const storedHashedPassword = user[0].hashedPassword;
        const isPasswordValid = await bcrypt.compare(password, storedHashedPassword);

        if (!isPasswordValid) {
            return { success: false, message: 'Geçersiz şifre' };
        }

        
        const otp = crypto.randomInt(100000, 999999).toString();
        await redis.set(`otp:${user[0].id}`, otp, 'EX', 300);
        

        return {
            success: true,
            message: 'Şifre doğrulandı otp kodu redise kaydedildi.',
            user: {
              id: user[0].id,
              username: user[0].username,
              email: user[0].email,
            },
          };
    } catch (error) {
        console.error('Login hatası:', error);
        return { success: false, message: 'Bir hata oluştu' };
    }
}