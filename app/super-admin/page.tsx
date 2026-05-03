export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SuperAdminDashboard from '@/components/SuperAdminDashboard'

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ _uid?: string }>
}) {
  const { _uid } = await searchParams

  // Prefer _uid param, then qt_uid cookie, then Clerk auth() as last resort
  let userId: string | null = _uid || null
  if (!userId) {
    const cookieStore = await cookies()
    userId = cookieStore.get('qt_uid')?.value
      ? decodeURIComponent(cookieStore.get('qt_uid')!.value)
      : null
  }
  if (!userId) {
    const { userId: clerkUserId } = await auth()
    userId = clerkUserId
  }
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

  const [{ data: groups }, { data: allMembers }, { data: allProjects }] = await Promise.all([
    supabase
      .from('groups')
      .select(`
        id, name, subdomain,
        firm_name_cn, firm_name_en,
        manager_name_cn, manager_name_en,
        created_at,
        group_members!inner(user_id, role, profiles(id, name, email))
      `)
      .eq('group_members.role', 'first_admin')
      .order('created_at', { ascending: false }),
    supabase.from('group_members').select('group_id, user_id'),
    supabase.from('projects').select('group_id'),
  ])

  // Fetch profiles with no group membership (pending users)
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, name, email, created_at')
    .eq('is_super_admin', false)
    .order('created_at', { ascending: false })

  const memberUserIds = new Set((allMembers || []).map((m: any) => m.user_id))
  const pending = (allProfiles || []).filter(p => !memberUserIds.has(p.id))

  // Build count maps
  const memberCountMap: Record<string, number> = {}
  for (const m of allMembers || []) {
    memberCountMap[m.group_id] = (memberCountMap[m.group_id] || 0) + 1
  }
  const projectCountMap: Record<string, number> = {}
  for (const p of allProjects || []) {
    projectCountMap[p.group_id] = (projectCountMap[p.group_id] || 0) + 1
  }

  const enrichedGroups = (groups || []).map(g => ({
    ...g,
    memberCount:  memberCountMap[g.id] || 0,
    projectCount: projectCountMap[g.id] || 0,
  }))

  return (
    <SuperAdminDashboard
      profile={profile}
      groups={enrichedGroups}
      pendingUsers={pending}
    />
  )
}
