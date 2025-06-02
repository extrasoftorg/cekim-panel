"use server"

import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { reportId: string } }) {
    const { reportId } = params;

    try {
        const response = await fetch(`https://report.cekim.golexe.com/v1/reports/${reportId}`, { credentials: 'include'});

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