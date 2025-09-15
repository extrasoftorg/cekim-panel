"use server"

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await context.params;

  try {
    const response = await fetch(`https://report.withdrawal.exgoapp.com/v1/reports/${reportId}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Rapor detayları alınamadı: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Hata:', error);
    return NextResponse.json(
      { error: 'Rapor detayları alınamadı.' },
      { status: 500 }
    );
  }
}
