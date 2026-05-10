import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup']

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Extension API routes use API-key auth — skip session checks, just add CORS
  if (pathname.startsWith('/api/extension/')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
    }
    const response = NextResponse.next()
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    return response
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Allow public routes through without redirect
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectedFrom', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // If logged in and hitting login page, redirect to dashboard
  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.searchParams.delete('redirectedFrom')
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (svg, png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
