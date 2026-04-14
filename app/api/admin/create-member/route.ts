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

  // Get caller's group from request body
  const { name, username, password, role, groupId } = await req.json()

  if (!groupId) return NextResponse.json({ error: '缺少团队参数' }, { status: 400 })

  // Verify caller is admin of this group
  const { data: caller } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 })
  }

  if (!name || !username || !password) {
    return NextResponse.json({ error: '姓名、用户名、密码均为必填' }, { status: 400 })
  }

  const domain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'company.internal'
  const email = `${username.trim()}@${domain}`

  // Create auth user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: role || 'member' },
  })

  if (error) {
    return NextResponse.json(
      { error: error.message.includes('already') ? '该用户名已存在' : error.message },
      { status: 400 }
    )
  }

  // Upsert profile
  await supabaseAdmin.from('profiles').upsert({
    id:    data.user.id,
    name,
    email,
    role:  role || 'member',
  })

  // Add to group
  const { error: memberError } = await supabaseAdmin.from('group_members').insert({
    group_id: groupId,
    user_id:  data.user.id,
    role:     role || 'member',
  })

  if (memberError) {
    return NextResponse.json({ error: '用户已创建，但加入团队失败：' + memberError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
