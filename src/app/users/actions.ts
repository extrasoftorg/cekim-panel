"use server";

import { db } from "@/db/index";
import { usersTable, userStatusLogsTable } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";

const registerUserSchema = z.object({
  username: z.string().min(3, { message: "Kullanıcı adı en az 3 karakter olmalı" }),
  email: z.string().email({ message: "Geçerli bir e-posta adresi girin" }),
  role: z.enum(["admin", "cekimSorumlusu", "cekimPersoneli", "spectator"], { message: "Geçersiz rol" }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalı" }),
});

type RegisterUserInput = z.infer<typeof registerUserSchema>;

const updateUserSchema = z.object({
  id: z.string().uuid({ message: "Geçersiz kullanıcı ID" }),
  username: z.string().min(3, { message: "Kullanıcı adı en az 3 karakter olmalı" }),
  role: z.enum(["admin", "cekimSorumlusu", "cekimPersoneli", "spectator"], { message: "Geçersiz rol" }),
});

const updatePasswordSchema = z.object({
  id: z.string().uuid({ message: "Geçersiz kullanıcı ID" }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalı" }),
});

type UpdateUserInput = z.infer<typeof updateUserSchema>;

const deleteUserSchema = z.object({
  id: z.string().uuid({ message: "Geçersiz kullanıcı ID" }),
});

type DeleteUserInput = z.infer<typeof deleteUserSchema>;

async function checkUserPermissions() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return { success: false, message: "Kullanıcı oturumu bulunamadı." };
  }

  const user = await getCurrentUser();

  if (!user) {
    console.error("Current user alınamadı: Kullanıcı bulunamadı");
    return { success: false, message: "Kullanıcı bilgisi alınamadı" };
  }

  const role = user.role?.toLowerCase();

  if (!role) {
    return { success: false, message: "Kullanıcı rolü bulunamadı" };
  }

  if (role !== "admin" && role !== "cekimsorumlusu") {
    return { success: false, message: "Bu işlemi gerçekleştirmek için yetkiniz yok" };
  }

  return { success: true, user };
}

export async function register(formData: FormData) {
  try {
    const permissionCheck = await checkUserPermissions();
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const user = permissionCheck.user;
    if (!user) {
      return { success: false, message: "Kullanıcı bilgisi alınamadı" };
    }
    const role = user.role.toLowerCase();

    const rawData = {
      username: formData.get("username")?.toString(),
      email: formData.get("email")?.toString(),
      role: formData.get("role")?.toString(),
      password: formData.get("password")?.toString(),
    };

    const validatedData = registerUserSchema.parse(rawData);

    if (role === "cekimsorumlusu" && validatedData.role === "admin") {
      return { success: false, message: "Çekim Sorumlusu, Yönetici rolüyle personel ekleyemez" };
    }

    const existingUserByUsername = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, validatedData.username))
      .limit(1)
      .then((res) => res[0] as { id: string } | undefined);

    if (existingUserByUsername) {
      return { success: false, message: "Bu kullanıcı adı zaten kullanımda" };
    }

    const existingUserByEmail = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, validatedData.email))
      .limit(1)
      .then((res) => res[0] as { id: string } | undefined);

    if (existingUserByEmail) {
      return { success: false, message: "Bu e-posta adresi zaten kullanımda" };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    const newUserId = uuidv4();
    await db.transaction(async (tx) => {
      await tx.insert(usersTable).values({
        id: newUserId,
        username: validatedData.username,
        email: validatedData.email,
        role: validatedData.role,
        hashedPassword,
        activityStatus: "offline",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(userStatusLogsTable).values({
        userId: newUserId,
        activityStatus: "offline",
        createdAt: new Date(),
      });
    });

    revalidatePath("/users");

    return { success: true, message: "Kullanıcı başarıyla kaydedildi" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message };
    }
    console.error("Personel ekleme Hatası:", error);
    if (error instanceof Error) {
      console.error("Hata Mesajı:", error.message);
      console.error("Hata Stack:", error.stack);
    }
    return { success: false, message: "Bir hata oluştu, lütfen tekrar deneyin" };
  }
}

export async function updateUser(formData: FormData) {
  try {
    const permissionCheck = await checkUserPermissions();
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const user = permissionCheck.user;
    if (!user) {
      return { success: false, message: "Kullanıcı bilgisi alınamadı" };
    }
    const role = user.role.toLowerCase();

    const rawData = {
      id: formData.get("id")?.toString(),
      username: formData.get("username")?.toString(),
      role: formData.get("role")?.toString(),
    };

    const validatedData = updateUserSchema.parse(rawData);

    if (role === "cekimsorumlusu" && validatedData.role === "admin") {
      return { success: false, message: "Çekim Sorumlusu, Yönetici rolüne güncelleyemez" };
    }

    const existingUserByUsername = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.username, validatedData.username),
        ne(usersTable.id, validatedData.id)
      ))
      .limit(1)
      .then((res) => res[0] as { id: string } | undefined);

    if (existingUserByUsername) {
      return { success: false, message: "Bu kullanıcı adı zaten kullanımda" };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          username: validatedData.username,
          role: validatedData.role,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, validatedData.id));

      const currentUser = await tx
        .select({ activityStatus: usersTable.activityStatus })
        .from(usersTable)
        .where(eq(usersTable.id, validatedData.id))
        .limit(1)
        .then((res) => res[0]);

      if (currentUser) {
        await tx.insert(userStatusLogsTable).values({
          userId: validatedData.id,
          activityStatus: currentUser.activityStatus,
          createdAt: new Date(),
        });
      }
    });

    revalidatePath("/users");

    return { success: true, message: "Kullanıcı başarıyla güncellendi" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message };
    }
    console.error("Kullanıcı güncelleme Hatası:", error);
    if (error instanceof Error) {
      console.error("Hata Mesajı:", error.message);
      console.error("Hata Stack:", error.stack);
    }
    return { success: false, message: "Bir hata oluştu, lütfen tekrar deneyin" };
  }
}

export async function deleteUser(formData: FormData) {
  try {
    const permissionCheck = await checkUserPermissions();
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const rawData = {
      id: formData.get("id")?.toString(),
    };

    const validatedData = deleteUserSchema.parse(rawData);

    const userExists = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, validatedData.id))
      .limit(1)
      .then((res) => res[0] as { id: string } | undefined);

    if (!userExists) {
      return { success: false, message: "Kullanıcı bulunamadı" };
    }

    await db.transaction(async (tx) => {
      const deletedLogs = await tx
        .delete(userStatusLogsTable)
        .where(eq(userStatusLogsTable.userId, validatedData.id))
        .returning({ deletedCount: userStatusLogsTable.userId });

      console.log(`Silinen log kayıtları: ${deletedLogs.length}`, deletedLogs);

      const deletedUser = await tx
        .delete(usersTable)
        .where(eq(usersTable.id, validatedData.id))
        .returning({ deletedId: usersTable.id });

      if (deletedUser.length === 0) {
        throw new Error("Kullanıcı silinemedi, kullanıcı bulunamadı");
      }

      console.log(`Silinen kullanıcı:`, deletedUser);
    });

    revalidatePath("/users");

    return { success: true, message: "Kullanıcı başarıyla silindi" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message };
    }
    console.error("Kullanıcı silme Hatası:", error);
    if (error instanceof Error) {
      const message = error.message.includes("foreign key constraint")
        ? "Kullanıcı silinemedi: İlgili log kayıtları silinemedi (foreign key constraint hatası)"
        : error.message.includes("Kullanıcı bulunamadı")
          ? "Kullanıcı bulunamadı"
          : `Kullanıcı silinirken bir hata oluştu: ${error.message}`;
      return { success: false, message };
    }
    return { success: false, message: "Bilinmeyen bir hata oluştu, lütfen tekrar deneyin" };
  }
}

export async function updatePassword(formData: FormData) {
  try {
    const permissionCheck = await checkUserPermissions();
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const rawData = {
      id: formData.get("id")?.toString(),
      password: formData.get("password")?.toString(),
    };

    const validatedData = updatePasswordSchema.parse(rawData);

    const userExists = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, validatedData.id))
      .limit(1)
      .then((res) => res[0] as { id: string } | undefined);

    if (!userExists) {
      return { success: false, message: "Kullanıcı bulunamadı" };
    }

    // Yeni şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    await db
      .update(usersTable)
      .set({
        hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, validatedData.id));

    revalidatePath("/users");

    return { success: true, message: "Şifre başarıyla güncellendi" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message };
    }
    console.error("Şifre güncelleme Hatası:", error);
    if (error instanceof Error) {
      console.error("Hata Mesajı:", error.message);
      console.error("Hata Stack:", error.stack);
    }
    return { success: false, message: "Bir hata oluştu, lütfen tekrar deneyin" };
  }
}