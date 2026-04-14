export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'

export default async function SubdomainAdminPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve subdomain → group
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, description')
    .eq('subdomain', subdomain)
    .single()

  if (!group) redirect(`/${subdomain}/projects`)

  const groupId = group.id

  // Only first_admin or second_admin can access
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['first_admin', 'second_admin'].includes(membership.role)) {
    redirect(`/${subdomain}/projects`)
  }

  const [
    { data: profile },
    { data: projects },
    { data: members },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('id', user.id).single(),
    supabase.from('projects')
      .select('id, name, client, status, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase.from('group_members')
      .select('role, created_at, profiles(id, name, email)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ])

  const effectiveProfile = { ...(profile || {}), id: user.id, role: membership.role }

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
      groupId={groupId}
      group={group}
      subdomain={subdomain}
    />
  )
}
