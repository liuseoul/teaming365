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

  const { memberId, groupId } = await req.json()

  if (!memberId || !groupId) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  }

  // Only first_admin may remove members
  const { data: caller } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (caller?.role !== 'first_admin') {
    return NextResponse.json({ error: '仅一级管理员可移除成员' }, { status: 403 })
  }

  // Cannot remove yourself
  if (memberId === user.id) {
    return NextResponse.json({ error: '不能移除自己' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
