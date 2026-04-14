export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const groupId = cookieStore.get('qt_group')?.value
  if (!groupId) redirect('/login')

  // Only group admins can access this page
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') redirect('/projects')

  const [
    { data: profile },
    { data: group },
    { data: projects },
    { data: members },
    { data: allGroups },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('id', user.id).single(),
    supabase.from('groups').select('id, name, description').eq('id', groupId).single(),
    supabase.from('projects')
      .select('id, name, client, status, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase.from('group_members')
      .select('role, created_at, profiles(id, name, email)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase.from('groups')
      .select('id, name, description, created_at')
      .order('created_at', { ascending: false }),
  ])

  const effectiveProfile = { ...(profile || {}), id: user.id, role: 'admin' }

  // Flatten members: [{id, name, email, role, created_at}]
  const flatMembers = (members || []).map((m: any) => ({
    id:         m.profiles?.id   || '',
    name:       m.profiles?.name || '',
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
      group={group || { id: groupId, name: '', description: '' }}
      allGroups={allGroups || []}
    />
  )
}
