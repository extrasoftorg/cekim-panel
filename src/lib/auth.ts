   import 'server-only';
   import { cookies } from 'next/headers';
   import { jwtVerify } from 'jose';
   import { db } from '@/db';
   import { usersTable } from '@/db/schema';
   import { eq } from 'drizzle-orm';

   export async function getCurrentUser() {
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