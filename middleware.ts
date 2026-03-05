import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const PUBLIC_PATHS = ['/login', '/auth']
const AUTH_COOKIE_RE = /-auth-token(?:\.\d+)?$/

const hasSupabaseAuthCookie = (request: NextRequest) =>
  request.cookies
    .getAll()
    .some((cookie) => AUTH_COOKIE_RE.test(cookie.name))

const clearSupabaseAuthCookies = (request: NextRequest, response: NextResponse) => {
  request.cookies.getAll().forEach((cookie) => {
    if (!AUTH_COOKIE_RE.test(cookie.name)) return

    response.cookies.set({
      name: cookie.name,
      value: '',
      path: '/',
      maxAge: 0
    })
  })
}

const redirectToLogin = (request: NextRequest, pathname: string) => {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/login'
  redirectUrl.searchParams.set('redirectedFrom', pathname)
  const response = NextResponse.redirect(redirectUrl)
  clearSupabaseAuthCookies(request, response)
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  if (isPublic) {
    return NextResponse.next()
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    return NextResponse.next()
  }

  const authCookieExists = hasSupabaseAuthCookie(request)
  if (!authCookieExists) {
    return redirectToLogin(request, pathname)
  }

  try {
    const { response, user } = await updateSession(request)
    if (!user) {
      return redirectToLogin(request, pathname)
    }
    return response
  } catch {
    return redirectToLogin(request, pathname)
  }
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|icon-192x192.png|icon-512x512.png|manifest.webmanifest).*)'
  ]
}
