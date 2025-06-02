"use server"

import { NextResponse, NextRequest } from "next/server"
import { db } from '@/db/index';
import { reportsTable } from "@/db/schema";
import { eq } from 'drizzle-orm';
import { getCurrentUser } from "../current-user/route"

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
                updatedAt: reportsTable.updatedAt
            })
            .from(reportsTable)

        return NextResponse.json(reports);
    } catch (error) {
        console.error("Reports alınamadı", error);
        return NextResponse.json({ success: false, error: "Reports alınamadı" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestedBy, status } = body;

    if (!requestedBy) {
      return NextResponse.json(
        { error: "requestedBy alanı zorunlu." },
        { status: 400 }
      );
    }

    const apiBody: { requestedBy: string; status?: string } = { requestedBy };
    if (status && status !== "all") {
      apiBody.status = status;
    }

    console.log("Sunucu tarafı rapor oluşturma isteği:", { apiBody });

    const response = await fetch("https://report.cekim.golexe.com/v1/reports", {
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