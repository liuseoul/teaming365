export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DailyDashboard from '@/components/DailyDashboard'

export default async function DashboardPage({
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

  const today = new Date().toISOString().slice(0, 10)

  // Compute 14-day window for reminders
  const in14 = new Date()
  in14.setDate(in14.getDate() + 14)
  const in14Str = in14.toISOString().slice(0, 10)

  const [
    { data: activeTodos },
    { data: todayReminders },
    { data: upcomingReminders },
    { data: activeProjects },
  ] = await Promise.all([
    // Active (incomplete) todos — includes overdue and due-today
    supabase.from('todos')
      .select('id, content, assignee_abbrev, assignee_abbrev_2, due_date, completed, created_at')
      .eq('group_id', group.id)
      .eq('completed', false)
      .eq('deleted', false)
      .order('due_date', { ascending: true, nullsFirst: false }),

    // Reminders starting today
    supabase.from('reminders')
      .select('id, content, type, start_date, end_date, due_date, start_time, end_time, assigned_to_name, pre_alert_days')
      .eq('group_id', group.id)
      .eq('deleted', false)
      .eq('start_date', today)
      .order('start_time', { ascending: true, nullsFirst: false }),

    // Upcoming reminders — next 14 days (excluding today, already in todayReminders)
    supabase.from('reminders')
      .select('id, content, type, start_date, end_date, due_date, start_time, end_time, assigned_to_name, pre_alert_days')
      .eq('group_id', group.id)
      .eq('deleted', false)
      .gt('start_date', today)
      .lte('start_date', in14Str)
      .order('start_date', { ascending: true }),

    // Active matters
    supabase.from('projects')
      .select('id, name, client, status, created_at')
      .eq('group_id', group.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  return (
    <DailyDashboard
      profile={effectiveProfile}
      groupId={group.id}
      groupName={group.name}
      subdomain={subdomain}
      today={today}
      activeTodos={activeTodos || []}
      todayReminders={todayReminders || []}
      upcomingReminders={upcomingReminders || []}
      activeProjects={activeProjects || []}
    />
  )
}
