import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const PUBLIC_PATHS = ['/login', '/auth']
const SESSION_TIMEOUT_MS = 3000

const fallbackResponse = (request: NextRequest) =>
  NextResponse.next({
    request: {
      headers: request.headers
    }
  })

const withTimeout = async (request: NextRequest) => {
  const timeout = new Promise<{ response: NextResponse; user: null }>((resolve) => {
    setTimeout(() => resolve({ response: fallbackResponse(request), user: null }), SESSION_TIMEOUT_MS)
  })

  try {
    return await Promise.race([updateSession(request), timeout])
  } catch {
    return { response: fallbackResponse(request), user: null }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  if (isPublic) {
    return NextResponse.next()
  }

  const { response, user } = await withTimeout(request)

  if (!user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|icon-192x192.png|icon-512x512.png|manifest.webmanifest).*)'
  ]
}
