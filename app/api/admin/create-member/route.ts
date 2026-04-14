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

  const { name, email, password, role, groupId } = await req.json()

  if (!groupId) return NextResponse.json({ error: '缺少团队参数' }, { status: 400 })

  // Verify caller is first_admin or second_admin of this group
  const { data: caller } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!caller || !['first_admin', 'second_admin'].includes(caller.role)) {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 })
  }

  // Role assignment rules: second_admin can only create 'member'
  const assignedRole = role || 'member'
  if (caller.role === 'second_admin' && assignedRole !== 'member') {
    return NextResponse.json({ error: '二级管理员只能创建普通成员' }, { status: 403 })
  }
  if (!['second_admin', 'member'].includes(assignedRole)) {
    return NextResponse.json({ error: '无效的角色' }, { status: 400 })
  }

  if (!name || !email || !password) {
    return NextResponse.json({ error: '姓名、邮箱、密码均为必填' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Create auth user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: name.trim(), role: assignedRole },
  })

  if (error) {
    return NextResponse.json(
      { error: error.message.includes('already') ? '该邮箱已被注册' : error.message },
      { status: 400 }
    )
  }

  // Upsert profile
  await supabaseAdmin.from('profiles').upsert({
    id:    data.user.id,
    name:  name.trim(),
    email: normalizedEmail,
    role:  assignedRole,
  })

  // Add to group
  const { error: memberError } = await supabaseAdmin.from('group_members').insert({
    group_id: groupId,
    user_id:  data.user.id,
    role:     assignedRole,
  })

  if (memberError) {
    return NextResponse.json({ error: '用户已创建，但加入团队失败：' + memberError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
