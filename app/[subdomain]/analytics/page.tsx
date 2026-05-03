export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'

export default async function AnalyticsPage({
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
  if (!membership || !['first_admin', 'second_admin'].includes(membership.role)) {
    redirect(`/${subdomain}/projects`)
  }

  const { data: profile } = await supabase
    .from('profiles').select('id, name').eq('id', userId).single()

  // Fetch all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, client, matter_type, status, service_fee_amount, service_fee_currency, created_at')
    .eq('group_id', group.id)

  // Fetch time_logs for the last 365 days
  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select('project_id, started_at, finished_at, billable, deleted')
    .eq('group_id', group.id)
    .eq('deleted', false)
    .gte('started_at', since.toISOString())

  // ── Server-side aggregations (not encrypted) ─────────────────

  // Revenue by matter_type
  const revenueByType: Record<string, number> = {}
  const countByType:   Record<string, number> = {}
  for (const p of projects || []) {
    const t = p.matter_type || 'other'
    revenueByType[t] = (revenueByType[t] || 0) + (p.service_fee_amount || 0)
    countByType[t]   = (countByType[t] || 0) + 1
  }

  // Status breakdown
  const statusCount: Record<string, number> = {}
  for (const p of projects || []) {
    statusCount[p.status] = (statusCount[p.status] || 0) + 1
  }

  // Monthly hours (last 12 months)
  const monthlyHours: Record<string, { billable: number; total: number }> = {}
  for (const l of timeLogs || []) {
    if (!l.finished_at) continue
    const mins = Math.round((new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 60000)
    if (mins <= 0) continue
    const month = l.started_at.slice(0, 7)
    if (!monthlyHours[month]) monthlyHours[month] = { billable: 0, total: 0 }
    monthlyHours[month].total += mins
    if (l.billable) monthlyHours[month].billable += mins
  }

  // Matters by month (creation)
  const mattersByMonth: Record<string, number> = {}
  for (const p of projects || []) {
    const month = p.created_at.slice(0, 7)
    mattersByMonth[month] = (mattersByMonth[month] || 0) + 1
  }

  // Total billable vs non-billable minutes
  let totalBillableMins = 0, totalNonBillableMins = 0
  for (const l of timeLogs || []) {
    if (!l.finished_at) continue
    const mins = Math.round((new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 60000)
    if (mins <= 0) continue
    if (l.billable) totalBillableMins += mins
    else totalNonBillableMins += mins
  }

  return (
    <AnalyticsDashboard
      profile={{ ...(profile || {}), id: userId, role: membership.role }}
      groupId={group.id}
      groupName={group.name}
      subdomain={subdomain}
      projects={projects || []}
      revenueByType={revenueByType}
      countByType={countByType}
      statusCount={statusCount}
      monthlyHours={monthlyHours}
      mattersByMonth={mattersByMonth}
      totalBillableMins={totalBillableMins}
      totalNonBillableMins={totalNonBillableMins}
    />
  )
}
