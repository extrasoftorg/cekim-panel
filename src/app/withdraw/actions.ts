'use server'

import { db } from '@/db';
import { withdrawalsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const updateWithdrawalSchema = z.object({
  id: z.number().int('Geçerli bir ID gerekli'),
  action: z.enum(['approve', 'reject'], { message: 'Geçerli bir işlem gerekli: approve veya reject' }),
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

    return { id: payload.userId };
  } catch (error) {
    console.error('JWT doğrulama hatası:', error);
    return null;
  }
}

export async function updateWithdrawalStatus({ id, action }: { id: number; action: 'approve' | 'reject' }) {
  try {

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Kullanıcı oturumu bulunamadı' };
    }


    const validatedData = updateWithdrawalSchema.parse({ id, action });

    const withdrawal = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, validatedData.id))
      .limit(1)
      .then(res => res[0]);

    if (!withdrawal) {
      return { success: false, error: 'Çekim talebi bulunamadı' };
    }

    if (withdrawal.handlingBy !== user.id) {
      return { success: false, error: 'Bu talebi sonuçlandırmaya yetkiniz yok' };
    }

    const status = validatedData.action === 'approve' ? 'approved' : 'rejected';

    const updatedWithdrawal = await db
      .update(withdrawalsTable)
      .set({
        withdrawalStatus: status,
        concludedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawalsTable.id, validatedData.id))
      .returning();

    if (updatedWithdrawal.length === 0) {
      return { success: false, error: 'Talep bulunamadı' };
    }

    revalidatePath('/withdrawals');

    const statuSS = status === 'approved' ? 'Onaylandı.' : 'Reddedildi.';

    return { success: true, message: `Talep Başarıyla ${statuSS}` };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors };
    }
    console.error('Hata:', error);
    return { success: false, error: 'Bir hata oluştu' };
  }
}