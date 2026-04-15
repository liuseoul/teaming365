import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/api/auth/(.*)',
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth()
  const isLoginPage = req.nextUrl.pathname === '/login'

  // Not logged in and trying to access a protected route
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Already logged in and hitting the login page — send to smart dispatcher
  if (userId && isLoginPage) {
    return NextResponse.redirect(new URL('/projects', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
