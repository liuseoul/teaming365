export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request) {
  // Get the authenticated Clerk user from the current session
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ redirect: 'login' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check super-admin flag in profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .single()

  if (profile?.is_super_admin) {
    return NextResponse.json({ redirect: 'super-admin' })
  }

  // Fetch group memberships
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, groups(id, name, description, subdomain)')
    .eq('user_id', userId)
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
