export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ProjectList from '@/components/ProjectList'

export default async function SubdomainProjectsPage({
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
    .from('groups').select('id, name, subdomain').eq('subdomain', subdomain).single()
  if (!group) redirect('/login')

  const { data: membership } = await supabase
    .from('group_members').select('role')
    .eq('group_id', group.id).eq('user_id', userId).single()
  if (!membership) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, name').eq('id', userId).single()

  const effectiveProfile = { ...(profile || {}), id: userId, role: membership.role }

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, client, description, status, created_at, updated_at,
      agreement_party, service_fee_currency, service_fee_amount, collaboration_parties,
      work_records(id, created_at, deleted, profiles!work_records_author_id_fkey(name)),
      time_logs(id, started_at, finished_at, deleted, profiles!time_logs_member_id_fkey(name))
    `)
    .eq('group_id', group.id)
    .order('created_at', { ascending: false })

  return (
    <ProjectList
      projects={projects || []}
      profile={effectiveProfile}
      groupId={group.id}
      groupName={group.name}
      subdomain={subdomain}
    />
  )
}
