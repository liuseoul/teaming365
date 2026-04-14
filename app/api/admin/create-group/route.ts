export const runtime = 'edge'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  // Any authenticated admin (of any group) can create a new group
  // We check if the caller is admin in at least one group
  const { data: anyMembership } = await supabase
    .from('group_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .single()

  if (!anyMembership) {
    return NextResponse.json({ error: '仅管理员可创建团队' }, { status: 403 })
  }

  const { name, description } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: '团队名称为必填' }, { status: 400 })
  }

  // Create the group
  const { data: newGroup, error: groupError } = await supabaseAdmin
    .from('groups')
    .insert({ name: name.trim(), description: description?.trim() || '' })
    .select('id')
    .single()

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 400 })
  }

  // Add the creator as admin of the new group
  await supabaseAdmin.from('group_members').insert({
    group_id: newGroup.id,
    user_id:  user.id,
    role:     'admin',
  })

  return NextResponse.json({ success: true, groupId: newGroup.id })
}
