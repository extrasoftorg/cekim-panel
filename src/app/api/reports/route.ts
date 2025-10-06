"use server"

import { NextResponse, NextRequest } from "next/server"
import { db } from '@/db/index';
import { reportsTable, usersTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ success: false, message: 'Kullanıcı oturumu bulunamadı' }, { status: 401 });
        }

        const reports = await db
            .select({
                id: reportsTable.id,
                codename: reportsTable.codename,
                status: reportsTable.status,
                createdBy: reportsTable.createdBy,
                createdAt: reportsTable.createdAt,
                updatedAt: reportsTable.updatedAt,
                createdByUsername: usersTable.username
            })
            .from(reportsTable)
            .leftJoin(usersTable, eq(reportsTable.createdBy, usersTable.id))

        return NextResponse.json(reports);
    } catch (error) {
        console.error("Reports alınamadı", error);
        return NextResponse.json({ success: false, error: "Reports alınamadı" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestedBy, status, rejectReasons, fromDate, toDate, type, typeNoteId } = body;

    if (!requestedBy) {
      return NextResponse.json(
        { error: "requestedBy alanı zorunlu." },
        { status: 400 }
      );
    }

    const apiBody: { 
      requestedBy: string; 
      status?: string;
      rejectReasons?: string[];
      fromDate?: string;
      toDate?: string;
      type?: string;
      typeNoteId?: string;
    } = { requestedBy };

    if (status && status !== "all" && ["pending", "approved", "rejected"].includes(status)) {
      apiBody.status = status;
    }

    if (rejectReasons && Array.isArray(rejectReasons) && rejectReasons.length > 0) {
      apiBody.rejectReasons = rejectReasons;
    }

    if (fromDate) {
      apiBody.fromDate = fromDate;
    }
    if (toDate) {
      apiBody.toDate = toDate;
    }

    if (type && ["bonus", "deposit", "withdrawal", "cashback", "correction_up"].includes(type)) {
      apiBody.type = type;
    }

    if (typeNoteId && typeof typeNoteId === "string" && typeNoteId.trim().length > 0) {
      apiBody.typeNoteId = typeNoteId.trim();
    }

    console.log("Sunucu tarafı rapor oluşturma isteği:", { apiBody });
    console.log("Gelen request body:", JSON.stringify(body, null, 2));
    console.log("Gönderilen API body:", JSON.stringify(apiBody, null, 2));

    const response = await fetch("https://report.withdrawal.exgoapp.com/v1/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiBody),
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Rapor oluşturma başarısız:", {
        status: response.status,
        statusText: response.statusText,
      });
      return NextResponse.json(
        {
          error: `Rapor oluşturulamadı: ${response.status}`,
          details: response.statusText || "Hata detayları alınamadı.",
        },
        { status: response.status }
      );
    }

    console.log("Rapor oluşturma başarılı: İstek gönderildi.");
    console.log("External API response status:", response.status);
    return NextResponse.json(
      { success: true, message: "Rapor başarıyla oluşturuldu." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Sunucu tarafı hata:", error);
    return NextResponse.json(
      {
        error: "Rapor oluşturulamadı.",
        details: error instanceof Error ? error.message : "Bilinmeyen hata.",
      },
      { status: 500 }
    );
  }
}