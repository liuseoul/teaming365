export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { accessToken } = await req.json()
  if (!accessToken) {
    return NextResponse.json({ redirect: 'login' }, { status: 401 })
  }

  // Use service role client: auth.getUser(token) verifies the JWT directly,
  // then service role bypasses RLS for profile/membership queries.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify the access token — returns null if invalid/expired
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
  if (!user || userError) {
    return NextResponse.json({ redirect: 'login' }, { status: 401 })
  }

  // Check super-admin (service role bypasses RLS, always returns the row)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.is_super_admin) {
    return NextResponse.json({ redirect: 'super-admin' })
  }

  // Fetch group memberships
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, groups(id, name, description, subdomain)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = (membership || []).map((m: any) => ({
    id:          m.groups?.id          || '',
    name:        m.groups?.name        || '',
    description: m.groups?.description || '',
    role:        m.role,
    subdomain:   m.groups?.subdomain   || null,
  })).filter((g: any) => g.id)

  return NextResponse.json({ redirect: 'groups', groups })
}
