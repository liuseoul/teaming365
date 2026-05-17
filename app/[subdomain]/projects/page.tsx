export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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

  // Prefer _uid param, then qt_uid cookie, then Clerk auth() as last resort.
  // auth() is a lazy dynamic import so Clerk server SDK never loads on the
  // Cloudflare Workers edge runtime unless it is actually needed.
  let userId: string | null = _uid || null
  if (!userId) {
    const cookieStore = await cookies()
    userId = cookieStore.get('qt_uid')?.value
      ? decodeURIComponent(cookieStore.get('qt_uid')!.value)
      : null
  }
  if (!userId) {
    try {
      const { auth } = await import('@clerk/nextjs/server')
      const { userId: clerkUserId } = await auth()
      userId = clerkUserId
    } catch {
      // Clerk auth unavailable on this runtime — fall through to redirect
    }
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
      work_records(id, created_at, deleted),
      time_logs(id, started_at, finished_at, deleted)
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
