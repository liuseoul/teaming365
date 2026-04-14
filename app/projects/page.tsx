export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Legacy redirect: /projects → /{subdomain}/projects
 * Also handles super-admin → /super-admin
 */
export default async function ProjectsRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Super-admin goes to their dashboard
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.is_super_admin) redirect('/super-admin')

  // Regular user: look up group from cookie
  const cookieStore = await cookies()
  const groupId = cookieStore.get('qt_group')?.value

  if (groupId) {
    const { data: group } = await supabase
      .from('groups')
      .select('subdomain')
      .eq('id', groupId)
      .single()

    if (group?.subdomain) redirect(`/${group.subdomain}/projects`)
  }

  // Fallback: find any group this user is in
  const { data: membership } = await supabase
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
