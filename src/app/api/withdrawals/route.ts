'use server'

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/index';
import { withdrawalsTable, usersTable } from '@/db/schema';
import { eq, or, desc, sql, and, like, gte, lte } from 'drizzle-orm';
import redis from '@/db/redis';
import { subHours } from 'date-fns';
import { 
  findFirstAutoEvaluationRejectReason,
  generateAutoEvaluationFactorsCombinedNote 
} from '@/constants/withdrawal-factors';

function extractTypeAndNoteId(latestPlayerActivity: any): { type: string | null, typeNoteId: string | null } {
  if (!latestPlayerActivity) {
    return { type: null, typeNoteId: null };
  }

  let type = latestPlayerActivity.type || null;
  if (type === 'correctionUp') {
    type = 'correction_up';
  }
  
  let typeNoteId: string | null = null;

  if (type === 'bonus' && latestPlayerActivity.data?.partnerId) {
    typeNoteId = latestPlayerActivity.data.partnerId.toString();
  }
  else if (type === 'correction_up' && latestPlayerActivity.data?.note) {
    typeNoteId = latestPlayerActivity.data.note;
  }
  else if (latestPlayerActivity.data) {
    if (latestPlayerActivity.data.note) {
      typeNoteId = latestPlayerActivity.data.note;
    }
    else if (latestPlayerActivity.data.partnerId) {
      typeNoteId = latestPlayerActivity.data.partnerId.toString();
    }
    else if (latestPlayerActivity.data.name) {
      typeNoteId = latestPlayerActivity.data.name;
    }
  }

  return { type, typeNoteId };
}

async function assignPersonnelFairly() {
  try {
    const listLength = await redis.llen('active_personnel');
    
    if (listLength === 0) {
      return null;
    }

    const personnelList = await redis.lrange('active_personnel', 0, -1);
    
    const firstPersonnelId = personnelList[0];
    
    const user = await db
      .select({ id: usersTable.id, role: usersTable.role, activityStatus: usersTable.activityStatus })
      .from(usersTable)
      .where(eq(usersTable.id, firstPersonnelId))
      .limit(1)
      .then(res => res[0]);

    if (!user || user.role.toLowerCase() !== 'cekimpersoneli' || user.activityStatus !== 'online') {
      for (let i = 1; i < personnelList.length; i++) {
        const personnelId = personnelList[i];
        const checkUser = await db
          .select({ id: usersTable.id, role: usersTable.role, activityStatus: usersTable.activityStatus })
          .from(usersTable)
          .where(eq(usersTable.id, personnelId))
          .limit(1)
          .then(res => res[0]);

        if (checkUser && checkUser.role.toLowerCase() === 'cekimpersoneli' && checkUser.activityStatus === 'online') {
          await redis.lrem('active_personnel', 1, personnelId);
          await redis.rpush('active_personnel', personnelId);
          await redis.set('last_assigned_personnel', personnelId);
          return personnelId;
        }
      }
      return null;
    }

    await redis.lpop('active_personnel');
    await redis.rpush('active_personnel', firstPersonnelId);
    await redis.set('last_assigned_personnel', firstPersonnelId);
    
    return firstPersonnelId;
  } catch (error) {
    console.error('Personel atama hatası:', error);
    return null;
  }
}

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
  latestPlayerActivity: z.object({
    type: z.enum(['bonus', 'deposit', 'withdrawal', 'cashback', 'correctionUp']),
    amount: z.number().positive(),
    createdAt: z.string().refine((val) => !isNaN(Date.parse(val))),
    data: z.record(z.any()),
  }).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const isExport = searchParams.get('export') === 'true';
    const take = isExport ? 10000 : Math.min(parseInt(searchParams.get('take') || '50'), 100);
    const page = isExport ? 0 : Math.max(parseInt(searchParams.get('page') || '0'), 0);
    const offset = page * take;
    
    const playerFullname = searchParams.get('playerFullname') || '';
    const method = searchParams.get('method') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const handler = searchParams.get('handler') || '';
    const note = searchParams.get('note') || '';
    
    const statusParam = searchParams.get('status') || '';
    const statuses = statusParam.split(',').map(s => s.trim());
    const validStatuses = ['pending', 'approved', 'rejected'] as const;
    type ValidStatus = typeof validStatuses[number];

    const filteredStatuses = statuses.filter((s): s is ValidStatus => validStatuses.includes(s as ValidStatus));

    if (filteredStatuses.length === 0) {
      return NextResponse.json({ error: 'Geçersiz veya eksik durum' }, { status: 400 });
    }

    const conditions = [];
    
    const statusConditions = filteredStatuses.map(status => eq(withdrawalsTable.withdrawalStatus, status));
    conditions.push(or(...statusConditions));
    
    if (playerFullname) {
      conditions.push(eq(withdrawalsTable.playerFullname, playerFullname));
    }
    if (method && method !== 'yontem') {
      conditions.push(eq(withdrawalsTable.method, method));
    }
    if (dateFrom) {
      conditions.push(gte(withdrawalsTable.concludedAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(withdrawalsTable.concludedAt, new Date(dateTo)));
    }
    if (handler && handler !== 'yetkili') {
      conditions.push(like(usersTable.username, `%${handler}%`));
    }
    if (note && note !== 'note') {
      conditions.push(like(withdrawalsTable.note, `%${note}%`));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(withdrawalsTable)
      .leftJoin(usersTable, eq(withdrawalsTable.handlingBy, usersTable.id))
      .where(whereCondition);
    
    const totalCount = totalCountResult[0]?.count || 0;

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
        hasTransfers: sql<boolean>`COALESCE(transfer_counts.count, 0) > 0`.mapWith(Boolean),
      })
      .from(withdrawalsTable)
      .leftJoin(usersTable, eq(withdrawalsTable.handlingBy, usersTable.id))
      .leftJoin(
        sql`(
          SELECT 
            withdrawal_id, 
            COUNT(*) as count 
          FROM withdrawal_transfers 
          GROUP BY withdrawal_id
        ) as transfer_counts`,
        sql`transfer_counts.withdrawal_id = ${withdrawalsTable.id}`
      )
      .where(whereCondition)
      .orderBy(desc(withdrawalsTable.concludedAt))
      .limit(take)
      .offset(offset);

    const hasPaginationParams = searchParams.has('take') || searchParams.has('page');
    
    if (isExport) {
      return NextResponse.json({
        data: withdrawals
      });
    } else if (hasPaginationParams) {
      return NextResponse.json({
        data: withdrawals,
        pagination: {
          page,
          take,
          total: totalCount,
          totalPages: Math.ceil(totalCount / take)
        }
      });
    } else {
      return NextResponse.json(withdrawals);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('Incoming withdrawal request body:');
    console.log(JSON.stringify(body, null, 2));
    
    let isAutoEvaluationRequest = false;
    let validatedData: any;
    
    try {
      validatedData = autoEvaluationWithdrawalSchema.parse(body);
      isAutoEvaluationRequest = true;
    } catch (autoEvalError) {
      try {
        validatedData = withdrawalSchema.parse(body);
        isAutoEvaluationRequest = false;
      } catch (manualError) {
        return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
      }
    }

    if (isAutoEvaluationRequest) {
      const { withdrawalInfo, evaluationFactors, metadata, latestPlayerActivity } = validatedData;
      
      const { type, typeNoteId } = extractTypeAndNoteId(latestPlayerActivity);

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
      const hasErrorOccurred = evaluationFactors.some((f: any) => f.factor === 'error_occurred');
      
      if (evaluationFactors.length === 0) {
        withdrawalStatus = 'approved';
        handlingBy = BOT_USER_ID;
        concludedAt = new Date();
      } else if (hasManualReviewPlayer || hasErrorOccurred) {
        withdrawalStatus = 'pending';
        
        handlingBy = await assignPersonnelFairly();
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
        
        handlingBy = await assignPersonnelFairly();
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
          requestedAt: subHours(new Date(withdrawalInfo.requestedAt), 3),
          concludedAt: concludedAt,
          message: withdrawalInfo.asText,
          withdrawalStatus: withdrawalStatus,
          handlingBy: handlingBy,
          assignedTo: withdrawalStatus === 'pending' && handlingBy && handlingBy !== BOT_USER_ID ? handlingBy : null,
          assignedAt: withdrawalStatus === 'pending' && handlingBy && handlingBy !== BOT_USER_ID ? new Date() : null,
          type: type as any,
          typeNoteId: typeNoteId,
        })
        .returning();

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

    // Adil personel ataması yap
    const assignedPersonnelId = await assignPersonnelFairly();

    const newWithdrawal = await db
      .insert(withdrawalsTable)
      .values({
        playerUsername: validatedData.playerUsername,
        playerFullname: validatedData.playerFullname,
        note: validatedData.note,
        transactionId: validatedData.transactionId,
        method: validatedData.method,
        amount: validatedData.amount,
        requestedAt: subHours(new Date(validatedData.requestedAt), 3),
        message: validatedData.message,
        withdrawalStatus: 'pending',
        handlingBy: assignedPersonnelId,
        assignedTo: assignedPersonnelId,
        assignedAt: assignedPersonnelId ? new Date() : null,
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