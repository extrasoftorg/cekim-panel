'use server'

import { db } from '@/db';
import { withdrawalsTable, usersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { format, addDays, startOfDay } from 'date-fns';
import redis from '@/db/redis';

const updateWithdrawalSchema = z.object({
  id: z.number().int('Geçerli bir ID gerekli'),
  action: z.enum(['approve', 'reject', 'manuelApprove', 'manuelReject'], { message: 'Geçerli bir işlem gerekli: approve, reject, manuelApprove veya manuelReject' }),
  deleteRemainingBalance: z.boolean().optional(),
  rejectReason: z.string().optional(),
  setBalance: z.boolean().optional(),
  customBalance: z.number().optional()
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
      .then((res) => res[0]);

    return user || null;
  } catch {
    return null;
  }
}

export async function updateWithdrawalStatus(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Kullanıcı oturumu bulunamadı' };
    }

    const userRole = user.role.toLowerCase();
    if (!['admin', 'cekimsorumlusu', 'cekimpersoneli'].includes(userRole)) {
      return { success: false, error: 'Bu talebi sonuçlandırmaya yetkiniz yok' };
    }

    const id = parseInt(formData.get('id') as string);
    const action = formData.get('action') as 'approve' | 'reject' | 'manuelApprove' | 'manuelReject';
    const deleteRemainingBalance = formData.get('deleteRemainingBalance') === 'true';
    const rejectReasonRaw = formData.get('rejectReason');
    const rejectReason = (action === 'approve' || action === 'manuelApprove') && rejectReasonRaw === null ? undefined : rejectReasonRaw;
    const additionalInfo = formData.get('additionalInfo') as string | null
    const setBalance = formData.get('setBalance') === 'true';
    const customBalanceRaw = formData.get('customBalance');
    const customBalance =
      customBalanceRaw === null || customBalanceRaw === ""
        ? undefined
        : Number(customBalanceRaw);

    const validatedData = updateWithdrawalSchema.parse({ id, action, deleteRemainingBalance, rejectReason, additionalInfo, setBalance, customBalance });

    const withdrawal = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.id, validatedData.id))
      .limit(1)
      .then((res) => res[0]);

    if (!withdrawal) {
      return { success: false, error: 'Çekim talebi bulunamadı' };
    }

    if (withdrawal.handlingBy !== user.id) {
      return { success: false, error: 'Bu talebi sonuçlandırmaya yetkiniz yok' };
    }

    const status = ['approve', 'manuelApprove'].includes(validatedData.action) ? 'approved' : 'rejected';

    let noteSuffix = '';
    switch (validatedData.action) {
      case 'approve':
        noteSuffix = ' | ONAY';
        break;
      case 'reject':
        noteSuffix = ' | RET';
        break;
      case 'manuelApprove':
        noteSuffix = ' | MANUEL - ONAY';
        break;
      case 'manuelReject':
        noteSuffix = ' | MANUEL - RET';
        break;
    }

    function translateAdditionalInfoKey(key: string): string {
      switch (key) {
        case 'kuponId':
          return 'Kupon ID';
        case 'coklu':
          return 'Çoklu Hesaplar';
        case 'kapaCoklu':
          return 'Kapatılan Hesaplar';
        case 'silCoklu':
          return 'Bakiyesi Silinen Hesaplar';
        case 'additionalInfo':
          return 'Not';
        default:
          return key;
      }
    }

    let combinedNote = withdrawal.note || '';
    let parsedAdditionalInfo = null;
    let updatedAdditionalInfo = null;

    if (additionalInfo && (action === 'reject' || action === 'manuelReject' || action === 'approve' || action === 'manuelApprove')) {
      try {
        parsedAdditionalInfo = JSON.parse(additionalInfo);

        updatedAdditionalInfo = { ...parsedAdditionalInfo };
        const keysToProcess = ['coklu', 'kapaCoklu', 'silCoklu'];

        for (const key of keysToProcess) {
          if (updatedAdditionalInfo[key] && typeof updatedAdditionalInfo[key] === 'string') {
            updatedAdditionalInfo[key] = updatedAdditionalInfo[key]
              .split(' ')
              .filter((item: string) => item.trim() !== '');
          }
        }

        const additionalInfoEntries = Object.entries(updatedAdditionalInfo)
          .filter(([key, value]) => value && (Array.isArray(value) ? value.length > 0 : true));

        if (additionalInfoEntries.length === 1 && additionalInfoEntries[0][0] === 'additionalInfo') {
          const [key, value] = additionalInfoEntries[0];
          const translatedKey = translateAdditionalInfoKey(key);
          combinedNote = combinedNote ? `${combinedNote} | ${translatedKey}: ${value}` : `${translatedKey}: ${value}`;
        } else {
          const additionalText = additionalInfoEntries
            .map(([key, value]) => {
              const translatedKey = translateAdditionalInfoKey(key);
              const displayValue = Array.isArray(value) ? value.join(',') : value;
              return `${translatedKey}: ${displayValue}`;
            })
            .join(', ');
          combinedNote = additionalText ? (combinedNote ? `${combinedNote} | Ek Bilgi: ${additionalText}` : `Ek Bilgi: ${additionalText}`) : combinedNote;
        }
      } catch (error) {
        return { success: false, error: 'Ek bilgiler geçersiz JSON formatında' };
      }
    }

    combinedNote = combinedNote ? `${combinedNote}${noteSuffix}` : noteSuffix.replace(' | ', '');

    if (['approve', 'reject'].includes(validatedData.action)) {
      const authToken = process.env.BETCONSTRUCT_API_KEY;
      if (!authToken) {
        return { success: false, error: 'API anahtarı bulunamadı' };
      }

      const today = startOfDay(new Date());
      const fromDateLocal = format(today, 'dd-MM-yy - HH:mm:ss');
      const toDateLocal = format(addDays(today, 1), 'dd-MM-yy - HH:mm:ss');

      const fetchNewResponse = await fetch(
        'https://backofficewebadmin.betconstruct.com/api/en/Client/GetClientWithdrawalRequestsWithTotals',
        {
          method: 'POST',
          headers: {
            'Authentication': authToken,
            'Content-Type': 'application/json',
            'referer': "https://backoffice.betconstruct.com/"
          },
          body: JSON.stringify({
            ByAllowDate: false,
            Id: withdrawal.transactionId,
            FromDateLocal: fromDateLocal,
            ToDateLocal: toDateLocal,
            StateList: [0],
          }),
        }
      );

      if (!fetchNewResponse.ok) {
        return { success: false, error: 'Betconstruct API isteği başarısız oldu' };
      }

      const result = await fetchNewResponse.json();
      const betcoWithdrawalDetails = result.Data.ClientRequests[0];

      if (!betcoWithdrawalDetails) {
        return { success: false, error: 'Üye çekim talebini iptal etmiş.' };
      }

      if (validatedData.action === 'approve') {
        const approvePayload = [{
          ...betcoWithdrawalDetails,
          PaidReason: ".",
          IsChecked: false,
          PaidUsername: "cekim",
        }];

        const fetchApprove = await fetch(
          'https://backofficewebadmin.betconstruct.com/api/en/Client/PayWithdrawalRequests',
          {
            method: 'POST',
            headers: {
              'Authentication': authToken,
              'Content-Type': 'application/json',
              'referer': "https://backoffice.betconstruct.com/"
            },
            body: JSON.stringify(approvePayload),
          }
        );

        if (!fetchApprove.ok) {
          return { success: false, error: 'Betconstruct onaylama isteği başarısız oldu' };
        }

        const approveResult = await fetchApprove.json();
        if (approveResult.HasError) {
          return { success: false, error: 'Betconstruct onaylama işlemi başarısız oldu' };
        }
      } else {
        const rejectPayload = [{
          Id: betcoWithdrawalDetails.Id,
          ClientId: betcoWithdrawalDetails.ClientId,
          ClientNotes: ".",
          RejectedReason: ".",
        }];

        console.log('=== REJECT DEBUG ===');
        console.log('Reject Payload:', JSON.stringify(rejectPayload, null, 2));
        console.log('Auth Token:', authToken ? 'Present' : 'Missing');
        
        const fetchReject = await fetch(
          'https://backofficewebadmin.betconstruct.com/api/en/Client/RejectWithdrawalRequests',
          {
            method: 'POST',
            headers: {
              'Authentication': authToken,
              'Content-Type': 'application/json',
              'referer': "https://backoffice.betconstruct.com/"
            },
            body: JSON.stringify(rejectPayload),
          }
        );

        console.log('Reject Response Status:', fetchReject.status);
        console.log('Reject Response Headers:', Object.fromEntries(fetchReject.headers.entries()));

        if (!fetchReject.ok) {
          const errorText = await fetchReject.text();
          console.log('Reject Error Response Body:', errorText);
          console.log('=== REJECT DEBUG END ===');
          return { success: false, error: `Betconstruct reddetme isteği başarısız oldu: ${fetchReject.status} - ${errorText}` };
        }

        const rejectResult = await fetchReject.json();
        console.log('Reject Success Response:', JSON.stringify(rejectResult, null, 2));
        
        if (rejectResult.HasError) {
          console.log('Reject HasError:', rejectResult.HasError);
          console.log('Reject Error Details:', rejectResult);
          console.log('=== REJECT DEBUG END ===');
          return { success: false, error: `Betconstruct reddetme işlemi başarısız oldu: ${rejectResult.ErrorMessage || 'Bilinmeyen hata'}` };
        }
        
        console.log('=== REJECT DEBUG END ===');
      }

       if (validatedData.setBalance && validatedData.customBalance !== undefined) {
        const getBalanceResponse = await fetch(
          'https://backofficewebadmin.betconstruct.com/api/en/Client/GetClients',
          {
            method: 'POST',
            headers: {
              'Authentication': authToken,
              'Content-Type': 'application/json',
              'referer': "https://backoffice.betconstruct.com/"
            },
            body: JSON.stringify({ Login: withdrawal.playerFullname }),
          }
        );

        if (!getBalanceResponse.ok) {
          return { success: false, error: 'Kullanıcı bakiyesi alınamadı' };
        }

        const balanceResult = await getBalanceResponse.json();
        const balance = balanceResult.Data.Objects[0]?.Balance;

        if (balance === undefined) {
          return { success: false, error: 'Kullanıcı bakiyesi alınamadı' };
        }

        const desiredBalance = validatedData.customBalance;
        const difference = desiredBalance - balance;

        if (difference !== 0) {
          if (difference > 0) {
            const depositResponse = await fetch(
              'https://backofficewebadmin.betconstruct.com/api/en/Client/CreateClientPaymentDocument',
              {
                method: 'POST',
                headers: {
                  'Authentication': authToken,
                  'Content-Type': 'application/json',
                  'referer': 'https://backoffice.betconstruct.com/',
                },
                body: JSON.stringify({
                  Amount: difference,
                  ClientId: withdrawal.playerUsername,
                  CurrencyId: 'TRY',
                  DocTypeInt: 3, // up
                }),
              }
            );

            if (!depositResponse.ok) {
              return { success: false, error: 'Bakiye artırılırken hata oluştu' };
            }
          } else {
            const withdrawAmount = Math.abs(difference);
            const withdrawResponse = await fetch(
              'https://backofficewebadmin.betconstruct.com/api/en/Client/CreateClientPaymentDocument',
              {
                method: 'POST',
                headers: {
                  'Authentication': authToken,
                  'Content-Type': 'application/json',
                  'referer': 'https://backoffice.betconstruct.com/',
                },
                body: JSON.stringify({
                  Amount: withdrawAmount,
                  ClientId: withdrawal.playerUsername,
                  CurrencyId: 'TRY',
                  DocTypeInt: 4, // down
                }),
              }
            );

            if (!withdrawResponse.ok) {
              return { success: false, error: 'Bakiye azaltılırken hata oluştu' };
            }
          }
        }
      }

      if (validatedData.deleteRemainingBalance) {
        const getBalanceResponse = await fetch(
          'https://backofficewebadmin.betconstruct.com/api/en/Client/GetClients',
          {
            method: 'POST',
            headers: {
              'Authentication': authToken,
              'Content-Type': 'application/json',
              'referer': "https://backoffice.betconstruct.com/"
            },
            body: JSON.stringify({ Login: withdrawal.playerFullname }),
          }
        );

        if (!getBalanceResponse.ok) {
          return { success: false, error: 'Kullanıcı bakiyesi alınamadı' };
        }

        const balanceResult = await getBalanceResponse.json();
        const balance = balanceResult.Data.Objects[0]?.Balance;

        if (balance !== undefined && balance > 0) {
          const deleteBalanceResponse = await fetch(
            'https://backofficewebadmin.betconstruct.com/api/en/Client/CreateClientPaymentDocument',
            {
              method: 'POST',
              headers: {
                'Authentication': authToken,
                'Content-Type': 'application/json',
                'referer': "https://backoffice.betconstruct.com/"
              },
              body: JSON.stringify({
                Amount: balance,
                ClientId: withdrawal.playerUsername,
                CurrencyId: "TRY",
                DocTypeInt: 4
              }),
            }
          );

          if (!deleteBalanceResponse.ok) {
            return { success: false, error: 'Kalan bakiye silinirken bir hata oluştu' };
          }
        }
      }
    }

    const updatedWithdrawal = await db
      .update(withdrawalsTable)
      .set({
        withdrawalStatus: status,
        concludedAt: new Date(),
        updatedAt: new Date(),
        note: combinedNote,
        additionalInfo: updatedAdditionalInfo,
        rejectReason: action === 'reject' || action === 'manuelReject' ? rejectReason as any : null,
      })
      .where(eq(withdrawalsTable.id, validatedData.id))
      .returning();

    if (updatedWithdrawal.length === 0) {
      return { success: false, error: 'Talep bulunamadı' };
    }

    const withdrawalId = updatedWithdrawal[0].id;
    const redisKey = `withdrawal:assignment:${withdrawalId}`;
    try {
      await redis.hset(redisKey, {
        concludedBy: user.id,
        concludedByUsername: user.username,
        transactionId: withdrawal.transactionId,
        playerUsername: withdrawal.playerFullname,
        result: status,
        concludedAt: updatedWithdrawal[0].concludedAt
          ? (updatedWithdrawal[0].concludedAt instanceof Date
            ? updatedWithdrawal[0].concludedAt.toISOString()
            : new Date(updatedWithdrawal[0].concludedAt).toISOString())
          : new Date().toISOString()
      })
    } catch (error) {
      console.error('Redis sonuç kaydetme hatası', error);
    }

    try {
      const redisKey = `user:${user.id}:statistics`;
      const globalKey = 'global:statistics';

      await redis.hset(redisKey, 'handlerUsername', user.username);

      if (['approve', 'manuelApprove'].includes(validatedData.action)) {
        await redis.hincrby(globalKey, 'totalApproved', 1);
        await redis.hincrbyfloat(globalKey, 'totalPaidAmount', withdrawal.amount);
      } else {
        // Ret işlemleri (hem otomatik hem manuel)
        await redis.hincrby(globalKey, 'totalRejected', 1);
      }

      switch (validatedData.action) {
        case 'approve':
          await redis.hincrby(redisKey, 'approved', 1);
          await redis.hincrbyfloat(redisKey, 'totalAmount', withdrawal.amount);
          break;
        case 'reject':
          await redis.hincrby(redisKey, 'rejected', 1);
          break;
        case 'manuelApprove':
          await redis.hincrby(redisKey, 'manualApproved', 1);
          await redis.hincrbyfloat(redisKey, 'totalAmount', withdrawal.amount);
          await redis.hincrby(globalKey, 'totalManuelApproved', 1);
          break;
        case 'manuelReject':
          await redis.hincrby(redisKey, 'manualRejected', 1);
          await redis.hincrby(globalKey, 'totalManuelRejected', 1);
          break;
      }

      // totalWithdrawals için global hash'te approved + rejected'ı güncelle
      const totalApproved = parseInt(await redis.hget(globalKey, 'totalApproved') || '0');
      const totalRejected = parseInt(await redis.hget(globalKey, 'totalRejected') || '0');
      const totalWithdrawals = totalApproved + totalRejected;
      await redis.hset(globalKey, 'totalWithdrawals', totalWithdrawals);

      // Ortalama işlem süresi hesaplama (onay ve ret için ayrı ayrı)
      const concludedAt = updatedWithdrawal[0].concludedAt
        ? (updatedWithdrawal[0].concludedAt instanceof Date ? updatedWithdrawal[0].concludedAt : new Date(updatedWithdrawal[0].concludedAt))
        : new Date();
      const requestedAt = withdrawal.requestedAt
        ? (withdrawal.requestedAt instanceof Date ? withdrawal.requestedAt : new Date(withdrawal.requestedAt))
        : new Date();

      const durationSeconds = (concludedAt.getTime() - requestedAt.getTime()) / 1000;
      let durationMinutes = durationSeconds / 60;

      if (durationMinutes < 0) {
        console.warn('Negative duration detected, setting to 0:', durationMinutes);
        durationMinutes = 0;
      }

      if (['approve', 'manuelApprove'].includes(validatedData.action)) {
        // Onay işlemleri için ortalama süre
        const currentApprovedCount = parseInt(await redis.hget(redisKey, 'approved') || '0') + parseInt(await redis.hget(redisKey, 'manualApproved') || '0');
        const currentAvgApproval = parseFloat(await redis.hget(redisKey, 'avgApprovalDuration') || '0');
        const newAvgApproval = currentApprovedCount > 0 ? ((currentAvgApproval * (currentApprovedCount - 1)) + durationMinutes) / currentApprovedCount : durationMinutes;
        await redis.hset(redisKey, 'avgApprovalDuration', newAvgApproval.toFixed(2));
      } else {
        // Ret işlemleri için ortalama süre
        const currentRejectedCount = parseInt(await redis.hget(redisKey, 'rejected') || '0') + parseInt(await redis.hget(redisKey, 'manualRejected') || '0');
        const currentAvgRejection = parseFloat(await redis.hget(redisKey, 'avgRejectionDuration') || '0');
        const newAvgRejection = currentRejectedCount > 0 ? ((currentAvgRejection * (currentRejectedCount - 1)) + durationMinutes) / currentRejectedCount : durationMinutes;
        await redis.hset(redisKey, 'avgRejectionDuration', newAvgRejection.toFixed(2));
      }

      if ((action === 'reject' || action === 'manuelReject') && rejectReason) {
        const rejectReasonKey = `global:rejectReason:${rejectReason}`;
        await redis.hincrby(rejectReasonKey, 'count', 1); // İşlem sayısını artır
        await redis.hincrbyfloat(rejectReasonKey, 'totalAmount', withdrawal.amount || 0); // Toplam tutarı güncelle
      }

    } catch (redisError) {
      console.error('Redis güncelleme hatası', redisError);
    }


    revalidatePath('/withdrawals');

    if (validatedData.action === 'manuelApprove') {
      return { success: true, message: 'Talep Manuel Olarak Onaylandı.' };
    } else if (validatedData.action === 'manuelReject') {
      return { success: true, message: 'Talep Manuel Olarak Reddedildi.' };
    } else {
      const actionMessage = status === 'approved' ? 'Onaylandı.' : 'Reddedildi.';
      return { success: true, message: `Talep Başarıyla ${actionMessage}` };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors };
    }
    return { success: false, error: 'Talep işleme alınamadı.' };
  }
}