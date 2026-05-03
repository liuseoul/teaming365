export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { callerUserId, email, role, title, groupId } = body

  if (!callerUserId) return NextResponse.json({ error: '未授权' }, { status: 401 })
  if (!groupId)      return NextResponse.json({ error: '缺少团队参数' }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: '请输入邮箱' }, { status: 400 })

  const { data: caller } = await supabase
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', callerUserId).single()
  if (!caller || !['first_admin', 'second_admin'].includes(caller.role)) {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 })
  }

  const assignedRole = role || 'member'
  if (caller.role === 'second_admin' && assignedRole !== 'member') {
    return NextResponse.json({ error: '二级管理员只能添加普通成员' }, { status: 403 })
  }

  const { data: targetProfile } = await supabase
    .from('profiles').select('id, name').eq('email', email.trim().toLowerCase()).single()
  if (!targetProfile) {
    return NextResponse.json({ error: '未找到该邮箱对应的用户，请让对方先注册账号' }, { status: 404 })
  }

  const { data: alreadyIn } = await supabase
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', targetProfile.id).maybeSingle()
  if (alreadyIn) return NextResponse.json({ error: '该用户已在本团队中' }, { status: 400 })

  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id:  targetProfile.id,
    role:     assignedRole,
    title:    title || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, userId: targetProfile.id, name: targetProfile.name })
}
