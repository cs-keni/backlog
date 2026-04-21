import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/feed',
  '/tracker',
  '/analytics',
  '/prep',
  '/profile',
  '/settings',
]

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname, search } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  if (!user && isProtected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectedFrom', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
