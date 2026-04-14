export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Called right after client-side signInWithPassword succeeds.
 * Determines where the user should be redirected:
 *   - super-admin  → { redirect: 'super-admin' }
 *   - normal user  → { redirect: 'groups', groups: [...] }
 */
export async function POST(_req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ redirect: 'login' }, { status: 401 })
  }

  // Server-side check: is this user a super-admin?
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
