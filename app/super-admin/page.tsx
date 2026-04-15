export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import SuperAdminDashboard from '@/components/SuperAdminDashboard'

export default async function SuperAdminPage() {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, is_super_admin')
    .eq('id', userId)
    .single()

  if (!profile?.is_super_admin) redirect('/login')

  const { data: groups } = await supabase
    .from('groups')
    .select(`
      id, name, subdomain,
      firm_name_cn, firm_name_en,
      manager_name_cn, manager_name_en,
      created_at,
      group_members!inner(user_id, role, profiles(id, name, email))
    `)
    .eq('group_members.role', 'first_admin')
    .order('created_at', { ascending: false })

  return (
    <SuperAdminDashboard
      profile={profile}
      groups={groups || []}
    />
  )
}
