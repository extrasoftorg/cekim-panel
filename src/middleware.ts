import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

interface NonProtectedRoute {
    path: string;
    method?: string;
}

const NON_PROTECTED_ROUTES: NonProtectedRoute[] = [
    { path: '/login' },
    { path: '/login/verification' },
    { path: '/api/withdrawals', method: 'POST' },

];

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
        } catch (error: any) {
            console.error('Token doğrulama hatası:', error);
            return false;
        }
    };

    const pathname = request.nextUrl.pathname;
    const method = request.method;

    // Check if the current route is in NON_PROTECTED_ROUTES
    const isNonProtectedRoute = NON_PROTECTED_ROUTES.some(route => 
        route.path === pathname && (!route.method || route.method === method)
    );

    if (!(await isValid())) {
        if (!isNonProtectedRoute) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    } else {
        if (isNonProtectedRoute && pathname.startsWith('/login')) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    }
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
