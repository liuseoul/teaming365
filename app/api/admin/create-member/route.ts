export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { name, email, password, role, groupId } = await req.json()
  if (!groupId) return NextResponse.json({ error: '缺少团队参数' }, { status: 400 })

  // Verify caller is first_admin or second_admin
  const { data: caller } = await supabase
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', userId).single()

  if (!caller || !['first_admin', 'second_admin'].includes(caller.role)) {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 })
  }

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

  // Create user in Clerk
  const clerk = await clerkClient()
  let clerkUser
  try {
    clerkUser = await clerk.users.createUser({
      emailAddress: [normalizedEmail],
      password,
      firstName: name.trim(),
      publicMetadata: { role: assignedRole },
    })
  } catch (err: any) {
    const msg = err?.errors?.[0]?.message || err?.message || '创建失败'
    return NextResponse.json(
      { error: msg.includes('already') ? '该邮箱已被注册' : msg },
      { status: 400 }
    )
  }

  // Upsert profile using Clerk user ID
  await supabase.from('profiles').upsert({
    id:    clerkUser.id,
    name:  name.trim(),
    email: normalizedEmail,
    role:  assignedRole,
  })

  // Add to group
  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id:  clerkUser.id,
    role:     assignedRole,
  })

  if (memberError) {
    return NextResponse.json({ error: '用户已创建，但加入团队失败：' + memberError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, newUserId: clerkUser.id })
}
