export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import SuperAdminDashboard from '@/components/SuperAdminDashboard'

export default async function SuperAdminPage() {
  // Step 1: verify auth via cookie-based client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Step 2: use service role to check is_super_admin — bypasses RLS and schema cache issues
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('id, name, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) redirect('/login')

  // Load all groups with their first-admins
  const { data: groups } = await admin
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
