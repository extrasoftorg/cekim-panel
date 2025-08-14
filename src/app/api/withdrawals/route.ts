'use server'

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/index';
import { withdrawalsTable, usersTable } from '@/db/schema';
import { eq, or, desc, sql } from 'drizzle-orm';
import redis from '@/db/redis';
import { 
  findFirstAutoEvaluationRejectReason,
  generateAutoEvaluationFactorsCombinedNote 
} from '@/constants/withdrawal-factors';

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

const autoEvaluationWithdrawalSchema = z.object({
  withdrawalInfo: z.object({
    id: z.number().int(),
    requestedAt: z.string().refine((val) => !isNaN(Date.parse(val))),
    paymentMethod: z.string().min(1),
    amount: z.number().positive(),
    playerUsername: z.string().min(1),
    playerFullName: z.string().min(1),
    playerId: z.number().int(),
    asText: z.string().min(1),
  }),
  evaluationFactors: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    factor: z.string(),
    type: z.enum(['rejection', 'manual_review']),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
  metadata: z.record(z.any()).optional(),
});

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
        hasTransfers: sql<boolean>`(SELECT COUNT(*) FROM withdrawal_transfers WHERE withdrawal_transfers.withdrawal_id = ${withdrawalsTable.id}) > 0`.mapWith(Boolean),
      })
      .from(withdrawalsTable)
      .leftJoin(usersTable, eq(withdrawalsTable.handlingBy, usersTable.id))
      .where(whereCondition)
      .orderBy(desc(withdrawalsTable.concludedAt));

    withdrawals.forEach(withdrawal => {
      if (withdrawal.handlingBy && !withdrawal.handlerUsername) {
        console.log(`handlingBy dolu ama handlerUsername null: withdrawalId=${withdrawal.id}, handlingBy=${withdrawal.handlingBy}`);
      }
    });

    return NextResponse.json(withdrawals);
  } catch (error) {
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('=== REQUEST BODY ===');
    console.log(JSON.stringify(body, null, 2));
    
    let isAutoEvaluationRequest = false;
    let validatedData: any;
    
    try {
      validatedData = autoEvaluationWithdrawalSchema.parse(body);
      isAutoEvaluationRequest = true;
      console.log('✅ Auto evaluation request validated');
    } catch (autoEvalError) {
      console.log('❌ Auto evaluation validation failed:');
      console.log(autoEvalError);
      try {
        validatedData = withdrawalSchema.parse(body);
        isAutoEvaluationRequest = false;
        console.log('✅ Manual withdrawal request validated');
      } catch (manualError) {
        console.log('❌ Manual validation failed:');
        console.log(manualError);
        return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
      }
    }

    if (isAutoEvaluationRequest) {
      const { withdrawalInfo, evaluationFactors, metadata } = validatedData;

      const BOT_USER_ID = 'bbe5c3c2-812d-4795-a87b-e01b859e13e4';
      const BOT_USERNAME = 'Çekim Botu';

      const botUser = await db
        .select({ id: usersTable.id, username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, BOT_USER_ID))
        .limit(1)
        .then(res => res[0]);

      if (!botUser) {
        console.error('Çekim Botu database\'de bulunamadı:', BOT_USER_ID);
        return NextResponse.json({ error: 'Çekim Botu bulunamadı' }, { status: 500 });
      }

      const hasRejectionFactor = evaluationFactors.some((factor: any) => factor.type === 'rejection');
      const hasManualReviewFactor = evaluationFactors.some((factor: any) => factor.type === 'manual_review');

      let withdrawalStatus: 'pending' | 'approved' | 'rejected';
      let handlingBy: string | null = null;
      let concludedAt: Date | null = null;
      let rejectReason: string | null = null;

      const hasManualReviewPlayer = evaluationFactors.some((f: any) => f.factor === 'manual_review_player');
      
      if (evaluationFactors.length === 0) {
        withdrawalStatus = 'approved';
        handlingBy = BOT_USER_ID;
        concludedAt = new Date();
      } else if (hasManualReviewPlayer) {
        withdrawalStatus = 'pending';
        
        const listLength = await redis.llen('active_personnel');
        
        if (listLength > 0) {
          const personnelList = await redis.lrange('active_personnel', 0, -1);
          
          for (let i = 0; i < personnelList.length; i++) {
            const personnelId = personnelList[i];
            const user = await db
              .select({ id: usersTable.id, role: usersTable.role, activityStatus: usersTable.activityStatus })
              .from(usersTable)
              .where(eq(usersTable.id, personnelId))
              .limit(1)
              .then(res => res[0]);

            if (user && user.role.toLowerCase() === 'cekimpersoneli' && user.activityStatus === 'online') {
              handlingBy = personnelId;
              
              await redis.lrem('active_personnel', 1, personnelId);
              await redis.rpush('active_personnel', personnelId);
              await redis.set('last_assigned_personnel', personnelId);
              break;
            }
          }
        }
      } else if (hasRejectionFactor) {
        withdrawalStatus = 'rejected';
        handlingBy = BOT_USER_ID;
        concludedAt = new Date();
        
        const rejectionFactors = evaluationFactors
          .filter((f: any) => f.type === 'rejection')
          .map((f: any) => f.factor);
        rejectReason = findFirstAutoEvaluationRejectReason(rejectionFactors);
      } else if (hasManualReviewFactor) {
        withdrawalStatus = 'pending';
        
        const listLength = await redis.llen('active_personnel');
        
        if (listLength > 0) {
          const personnelList = await redis.lrange('active_personnel', 0, -1);
          
          for (let i = 0; i < personnelList.length; i++) {
            const personnelId = personnelList[i];
            const user = await db
              .select({ id: usersTable.id, role: usersTable.role, activityStatus: usersTable.activityStatus })
              .from(usersTable)
              .where(eq(usersTable.id, personnelId))
              .limit(1)
              .then(res => res[0]);

            if (user && user.role.toLowerCase() === 'cekimpersoneli' && user.activityStatus === 'online') {
              handlingBy = personnelId;
              
              await redis.lrem('active_personnel', 1, personnelId);
              await redis.rpush('active_personnel', personnelId);
              await redis.set('last_assigned_personnel', personnelId);
              break;
            }
          }
        }
      } else {
        withdrawalStatus = 'pending';
      }

      const factorStrings = evaluationFactors.map((f: any) => f.factor);
      const combinedNote = generateAutoEvaluationFactorsCombinedNote(factorStrings, metadata);

      let finalNote: string;
      if (withdrawalStatus === 'approved') {
        finalNote = 'ONAY';
      } else if (withdrawalStatus === 'rejected') {
        finalNote = combinedNote ? `${combinedNote} | RET` : 'RET';
      } else {
        finalNote = combinedNote || 'Otomatik değerlendirme ile işlenmiş talep';
      }

      const additionalInfo = {
        evaluationFactors: evaluationFactors,
        metadata: metadata,
        processedAt: new Date().toISOString(),
        source: 'auto_evaluation'
      };
      
      const newWithdrawal = await db
        .insert(withdrawalsTable)
        .values({
          playerUsername: withdrawalInfo.playerId,
          playerFullname: withdrawalInfo.playerUsername,
          note: finalNote,
          additionalInfo: additionalInfo,
          rejectReason: rejectReason as any,
          transactionId: withdrawalInfo.id,
          method: withdrawalInfo.paymentMethod,
          amount: withdrawalInfo.amount,
          requestedAt: withdrawalInfo.requestedAt,
          concludedAt: concludedAt,
          message: withdrawalInfo.asText,
          withdrawalStatus: withdrawalStatus,
          handlingBy: handlingBy,
        })
        .returning();

      if (handlingBy && withdrawalStatus === 'pending') {
        const assignedUser = await db
          .select({ username: usersTable.username })
          .from(usersTable)
          .where(eq(usersTable.id, handlingBy))
          .limit(1)
          .then(res => res[0]);
          
        if (assignedUser) {
          const withdrawalId = newWithdrawal[0].id;
          const redisKey = `withdrawal:assignment:${withdrawalId}`;
          await redis.hset(redisKey, {
            id: handlingBy,
            playerUsername: newWithdrawal[0].playerFullname,
            transactionId: newWithdrawal[0].transactionId,
            username: assignedUser.username,
            assignedAt: new Date().toISOString(),
          });
        }
      }

      try {
        const globalKey = 'global:statistics';
        const botKey = `user:${BOT_USER_ID}:statistics`;

        if (withdrawalStatus === 'approved') {
          await redis.hincrby(globalKey, 'totalApproved', 1);
          await redis.hincrbyfloat(globalKey, 'totalPaidAmount', withdrawalInfo.amount);
        } else if (withdrawalStatus === 'rejected') {
          await redis.hincrby(globalKey, 'totalRejected', 1);
        }

        await redis.hset(botKey, 'handlerUsername', BOT_USERNAME);
        
        if (withdrawalStatus === 'approved') {
          await redis.hincrby(botKey, 'approved', 1);
          await redis.hincrbyfloat(botKey, 'totalAmount', withdrawalInfo.amount);
        } else if (withdrawalStatus === 'rejected') {
          await redis.hincrby(botKey, 'rejected', 1);
        }

        const totalApproved = parseInt(await redis.hget(globalKey, 'totalApproved') || '0');
        const totalRejected = parseInt(await redis.hget(globalKey, 'totalRejected') || '0');
        const totalWithdrawals = totalApproved + totalRejected;
        await redis.hset(globalKey, 'totalWithdrawals', totalWithdrawals);

        if (withdrawalStatus === 'rejected' && rejectReason) {
          const rejectReasonKey = `global:rejectReason:${rejectReason}`;
          await redis.hincrby(rejectReasonKey, 'count', 1);
          await redis.hincrbyfloat(rejectReasonKey, 'totalAmount', withdrawalInfo.amount);
        }

      } catch (redisError) {
        console.error('Bot statistics update error:', redisError);
      }

      let message = 'Çekim talebi başarıyla işlendi';
      
      switch (withdrawalStatus) {
        case 'approved':
          message += ' ve otomatik olarak onaylandı';
          break;
        case 'rejected':
          message += ' ve otomatik olarak reddedildi';
          if (rejectReason) message += ` (Sebep: ${rejectReason})`;
          break;
        case 'pending':
          if (handlingBy) {
            const assignedUser = await db
              .select({ username: usersTable.username })
              .from(usersTable)
              .where(eq(usersTable.id, handlingBy))
              .limit(1)
              .then(res => res[0]);
            if (assignedUser) {
              message += ` ve ${assignedUser.username} kişisine atandı`;
            }
          } else {
            message += ', ancak aktif çevrimiçi personel bulunamadı';
          }
          break;
      }

      return NextResponse.json({ 
        message,
        withdrawal: newWithdrawal[0],
        status: withdrawalStatus 
      }, { status: 201 });
    }

    const listLength = await redis.llen('active_personnel');
    let assignedPersonnelId: string | null = null;

    if (listLength > 0) {
      const personnelList = await redis.lrange('active_personnel', 0, -1);
      let foundOnlinePersonnel = false;

      for (let i = 0; i < personnelList.length; i++) {
        const personnelId = personnelList[i];
        const user = await db
          .select({ id: usersTable.id, role: usersTable.role, activityStatus: usersTable.activityStatus })
          .from(usersTable)
          .where(eq(usersTable.id, personnelId))
          .limit(1)
          .then(res => res[0]);

        if (user && user.role.toLowerCase() === 'cekimpersoneli' && user.activityStatus === 'online') {
          assignedPersonnelId = personnelId;
          foundOnlinePersonnel = true;

          await redis.lrem('active_personnel', 1, personnelId);
          await redis.rpush('active_personnel', personnelId);
          await redis.set('last_assigned_personnel', personnelId);
          break;
        }
      }

      if (!foundOnlinePersonnel) {
        console.log('Hiç çevrimiçi personel bulunamadı, talep boşa atanıyor.');
        assignedPersonnelId = null;
      }
    } else {
      console.log('Aktif personel listesi boş, talep boşa atanıyor.');
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
        requestedAt: validatedData.requestedAt,
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
      if (assignedUser) {
        const withdrawalId = newWithdrawal[0].id
        const redisKey = `withdrawal:assignment:${withdrawalId}`
        await redis.hset(redisKey, {
          id: assignedPersonnelId,
          playerUsername: newWithdrawal[0].playerFullname,
          transactionId: newWithdrawal[0].transactionId,
          username: assignedUser.username,
          assignedAt: new Date().toISOString(),
        })
        message += ` ve ${assignedUser.username} kişisine atandı`;
      } else {
        message += ', ancak atanan personel bulunamadı';
      }
    } else {
      message += ', ancak aktif çevrimiçi çekim personeli bulunamadı';
    }

    return NextResponse.json({ message }, { status: 201 });
      } catch (error) {
      console.log('❌ POST endpoint error:');
      console.log(error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors }, { status: 400 });
      }
      return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
    }
}