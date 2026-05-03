export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import InvoiceView from '@/components/InvoiceView'

export default async function InvoicePage({
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
    .from('groups')
    .select('id, name, firm_name_en, firm_name_cn, subdomain')
    .eq('subdomain', subdomain).single()
  if (!group) redirect('/login')

  const { data: membership } = await supabase
    .from('group_members').select('role')
    .eq('group_id', group.id).eq('user_id', userId).single()
  if (!membership || !['first_admin', 'second_admin'].includes(membership.role)) {
    redirect(`/${subdomain}/projects`)
  }

  const { data: profile } = await supabase
    .from('profiles').select('id, name').eq('id', userId).single()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, client, service_fee_currency, service_fee_amount, status')
    .eq('group_id', group.id)
    .order('created_at', { ascending: false })

  return (
    <InvoiceView
      profile={{ ...(profile || {}), id: userId, role: membership.role }}
      group={group}
      groupId={group.id}
      subdomain={subdomain}
      projects={projects || []}
    />
  )
}
