export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'

export default async function SubdomainAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ _uid?: string }>
}) {
  const { subdomain } = await params
  const { _uid } = await searchParams

  let userId: string | null = _uid || null
  if (!userId) {
    const { userId: clerkUserId } = await auth()
    userId = clerkUserId
  }
  if (!userId) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: group } = await supabase
    .from('groups').select('id, name, description').eq('subdomain', subdomain).single()
  if (!group) redirect(`/${subdomain}/projects`)

  const { data: membership } = await supabase
    .from('group_members').select('role')
    .eq('group_id', group.id).eq('user_id', userId).single()

  if (!membership || !['first_admin', 'second_admin'].includes(membership.role)) {
    redirect(`/${subdomain}/projects`)
  }

  const [{ data: profile }, { data: projects }, { data: members }] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('id', userId).single(),
    supabase.from('projects')
      .select('id, name, client, status, created_at')
      .eq('group_id', group.id).order('created_at', { ascending: false }),
    supabase.from('group_members')
      .select('role, created_at, profiles(id, name, email)')
      .eq('group_id', group.id).order('created_at', { ascending: false }),
  ])

  const effectiveProfile = { ...(profile || {}), id: userId, role: membership.role }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatMembers = (members || []).map((m: any) => ({
    id:         m.profiles?.id    || '',
    name:       m.profiles?.name  || '',
    email:      m.profiles?.email || '',
    role:       m.role,
    created_at: m.created_at,
  }))

  return (
    <AdminDashboard
      profile={effectiveProfile}
      projects={projects || []}
      members={flatMembers}
      groupId={group.id}
      group={group}
      subdomain={subdomain}
    />
  )
}
