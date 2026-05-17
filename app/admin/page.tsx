export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Legacy redirect: /admin → /{subdomain}/admin
 */
export default async function AdminRedirect() {
  const cookieStore = await cookies()

  // Prefer qt_uid cookie, then Clerk auth()
  let userId: string | null = cookieStore.get('qt_uid')?.value
    ? decodeURIComponent(cookieStore.get('qt_uid')!.value)
    : null
  if (!userId) {
    try {
      const { auth } = await import('@clerk/nextjs/server')
      const { userId: clerkUserId } = await auth()
      userId = clerkUserId
    } catch {
      // Clerk auth unavailable on this runtime — fall through to redirect
    }
  }
  if (!userId) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const groupId = cookieStore.get('qt_group')?.value

  if (groupId) {
    const { data: group } = await supabase
      .from('groups')
      .select('subdomain')
      .eq('id', groupId)
      .single()

    if (group?.subdomain) redirect(`/${group.subdomain}/admin`)
  }

  // Fall back: find first group the user belongs to as admin
  const { data: membership } = await supabase
    .from('group_members')
    .select('groups(subdomain)')
    .eq('user_id', userId)
    .in('role', ['first_admin', 'second_admin'])
    .limit(1)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subdomain = (membership as any)?.groups?.subdomain
  if (subdomain) redirect(`/${subdomain}/admin`)

  redirect('/projects')
}
