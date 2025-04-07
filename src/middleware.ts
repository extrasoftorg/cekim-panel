import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const isValid = async () => {
        try {
            if (!token) {
                console.log('Token yok');
                return false;
            }
            const secret = new TextEncoder().encode(process.env.JWT_SECRET);
            await jwtVerify(token, secret); 
            console.log('Token geçerli');
            return true;
        } catch (error) {
            console.error('Token doğrulama hatası:', error);
            return false;
        }
    };

    const pathname = request.nextUrl.pathname;
    const loginPaths = ['/login', '/login/verification'];

    if (!(await isValid())) {
        if (!loginPaths.includes(pathname)) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    } else {
        if (loginPaths.includes(pathname)) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    }
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};