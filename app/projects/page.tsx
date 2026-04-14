export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Smart dispatcher — redirects to the correct destination:
 *   super-admin  → /super-admin
 *   group member → /[subdomain]/projects
 *   no group     → /login
 */
export default async function ProjectsRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use service role to check is_super_admin (bypasses RLS + schema cache)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.is_super_admin) redirect('/super-admin')

  // Regular user: look up group from cookie
  const cookieStore = await cookies()
  const groupId = cookieStore.get('qt_group')?.value

  if (groupId) {
    const { data: group } = await admin
      .from('groups')
      .select('subdomain')
      .eq('id', groupId)
      .single()

    if (group?.subdomain) redirect(`/${group.subdomain}/projects`)
  }

  // Fallback: find any group this user is in
  const { data: membership } = await admin
    .from('group_members')
    .select('group_id, groups(subdomain)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subdomain = (membership as any)?.groups?.subdomain
  if (subdomain) redirect(`/${subdomain}/projects`)

  redirect('/login')
}
