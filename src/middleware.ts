import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/login') return NextResponse.next()

  // Check for any Supabase auth cookie
  const hasAuthCookie = req.cookies.get('sb-auth')?.value === 'true'

  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
