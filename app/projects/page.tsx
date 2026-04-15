export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function ProjectsRedirect() {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check super-admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .single()

  if (profile?.is_super_admin) redirect('/super-admin')

  // Look up group from cookie
  const cookieStore = await cookies()
  const groupId = cookieStore.get('qt_group')?.value

  if (groupId) {
    const { data: group } = await supabase
      .from('groups').select('subdomain').eq('id', groupId).single()
    if (group?.subdomain) redirect(`/${group.subdomain}/projects`)
  }

  // Fallback: first group this user is in
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups(subdomain)')
    .eq('user_id', userId)
    .limit(1)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subdomain = (membership as any)?.groups?.subdomain
  if (subdomain) redirect(`/${subdomain}/projects`)

  redirect('/login')
}
