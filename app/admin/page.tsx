export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Legacy redirect: /admin → /{subdomain}/admin
 */
export default async function AdminRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const groupId = cookieStore.get('qt_group')?.value

  if (groupId) {
    const { data: group } = await supabase
      .from('groups')
      .select('subdomain')
      .eq('id', groupId)
      .single()

    if (group?.subdomain) redirect(`/${group.subdomain}/admin`)
  }

  redirect('/projects')
}
