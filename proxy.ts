import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export async function proxy(request: NextRequest) {
    const session = getSessionCookie(request)

    const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard")
    const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
        request.nextUrl.pathname.startsWith("/registro")

    if (!session && isProtectedRoute) {
        return NextResponse.redirect(new URL("/login", request.url))
    }

    if (session && isAuthRoute) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}