import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    cookieStore.delete('token');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Başarıyla çıkış yapıldı' 
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Çıkış yapılırken hata oluştu' },
      { status: 500 }
    );
  }
}
