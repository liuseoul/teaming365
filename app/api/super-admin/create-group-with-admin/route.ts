export const runtime = 'edge'

import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { callerUserId, firmNameCn, firmNameEn, managerNameCn, managerNameEn, managerEmail, password } = body

  // Verify caller is super-admin via Supabase (avoids Clerk JWKS hang on edge)
  const userId = callerUserId
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_super_admin').eq('id', userId).single()
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: '仅超级管理员可操作' }, { status: 403 })
  }

  if (!firmNameCn?.trim() || !firmNameEn?.trim() || !managerNameCn?.trim() ||
      !managerNameEn?.trim() || !managerEmail?.trim() || !password) {
    return NextResponse.json({ error: '所有字段均为必填' }, { status: 400 })
  }

  const pwdError = validatePassword(password)
  if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 })

  const subdomain = (firmNameEn.trim() + managerNameEn.trim())
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  if (!subdomain) return NextResponse.json({ error: '英文名称必须包含字母或数字' }, { status: 400 })

  const { data: existing } = await supabase
    .from('groups').select('id').eq('subdomain', subdomain).maybeSingle()
  if (existing) return NextResponse.json({ error: `子路径 "${subdomain}" 已被占用` }, { status: 400 })

  // Create first-admin in Clerk
  const clerk = await clerkClient()
  let clerkUser
  try {
    clerkUser = await clerk.users.createUser({
      emailAddress: [managerEmail.trim().toLowerCase()],
      password,
      firstName: managerNameCn.trim(),
      publicMetadata: { role: 'first_admin' },
    })
  } catch (err: any) {
    const msg = err?.errors?.[0]?.message || err?.message || '创建失败'
    return NextResponse.json(
      { error: msg.includes('already') ? '该邮箱已被注册' : msg },
      { status: 400 }
    )
  }

  // Upsert profile
  await supabase.from('profiles').upsert({
    id:    clerkUser.id,
    name:  managerNameCn.trim(),
    email: managerEmail.trim().toLowerCase(),
    role:  'admin',
  })

  // Create group
  const { data: newGroup, error: groupError } = await supabase
    .from('groups')
    .insert({
      name:            firmNameCn.trim(),
      description:     firmNameEn.trim(),
      firm_name_cn:    firmNameCn.trim(),
      firm_name_en:    firmNameEn.trim(),
      manager_name_cn: managerNameCn.trim(),
      manager_name_en: managerNameEn.trim(),
      subdomain,
    })
    .select('id').single()

  if (groupError) {
    await clerk.users.deleteUser(clerkUser.id)
    return NextResponse.json({ error: groupError.message }, { status: 400 })
  }

  // Add first-admin to group
  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: newGroup.id,
    user_id:  clerkUser.id,
    role:     'first_admin',
  })

  if (memberError) {
    return NextResponse.json({ error: '团队已创建，但关联管理员失败：' + memberError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, subdomain, groupId: newGroup.id })
}

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8)             return '密码至少 8 位'
  if (!/^[A-Za-z]/.test(pwd))    return '密码必须以字母开头'
  if (!/[A-Z]/.test(pwd))        return '密码必须包含大写字母'
  if (!/[a-z]/.test(pwd))        return '密码必须包含小写字母'
  if (!/[0-9]/.test(pwd))        return '密码必须包含数字'
  if (!/[^A-Za-z0-9]/.test(pwd)) return '密码必须包含特殊字符'
  return null
}
