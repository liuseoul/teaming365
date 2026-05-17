export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function RootPage() {
  // Check qt_uid cookie first (avoids Clerk JWKS hang on Cloudflare edge)
  const cookieStore = await cookies()
  let userId: string | null = cookieStore.get('qt_uid')?.value
    ? decodeURIComponent(cookieStore.get('qt_uid')!.value)
    : null
  if (!userId) {
    try {
      const { auth } = await import('@clerk/nextjs/server')
      const { userId: clerkUserId } = await auth()
      userId = clerkUserId
    } catch {
      userId = null
    }
  }

  if (userId) redirect('/projects')
  else redirect('/login')
}
