export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import ProjectList from '@/components/ProjectList'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const groupId = cookieStore.get('qt_group')?.value
  if (!groupId) redirect('/login')

  // Verify membership & get role for this group
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/login')

  const [{ data: profile }, { data: group }] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('id', user.id).single(),
    supabase.from('groups').select('id, name').eq('id', groupId).single(),
  ])

  // Role is group-scoped, not global
  const effectiveProfile = { ...(profile || {}), id: user.id, role: membership.role }

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, client, description, status, created_at, updated_at,
      agreement_party, service_fee_currency, service_fee_amount, collaboration_parties,
      work_records(id, created_at, deleted, profiles!work_records_author_id_fkey(name)),
      time_logs(id, started_at, finished_at, deleted, profiles!time_logs_member_id_fkey(name))
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  return (
    <ProjectList
      projects={projects || []}
      profile={effectiveProfile}
      groupId={groupId}
      groupName={group?.name || ''}
    />
  )
}
