export const runtime = 'edge'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify caller is super-admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: '仅超级管理员可操作' }, { status: 403 })
  }

  const {
    firmNameCn, firmNameEn,
    managerNameCn, managerNameEn,
    managerEmail,
    password,
  } = await req.json()

  if (!firmNameCn?.trim() || !firmNameEn?.trim() || !managerNameCn?.trim() || !managerNameEn?.trim() || !managerEmail?.trim() || !password) {
    return NextResponse.json({ error: '所有字段均为必填' }, { status: 400 })
  }

  // Validate password
  const pwdError = validatePassword(password)
  if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 })

  // Build subdomain: firmEN + managerEN, lowercase, alphanumeric only, max 40 chars
  const subdomain = (firmNameEn.trim() + managerNameEn.trim())
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40)

  if (!subdomain) {
    return NextResponse.json({ error: '英文名称必须包含字母或数字' }, { status: 400 })
  }

  // Check subdomain uniqueness
  const { data: existing } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('subdomain', subdomain)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `子路径 "${subdomain}" 已被占用，请修改英文名称` }, { status: 400 })
  }

  // Create auth user for first-admin
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: managerEmail.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: managerNameCn.trim(), role: 'first_admin' },
  })

  if (authError) {
    return NextResponse.json(
      { error: authError.message.includes('already') ? '该邮箱已被注册' : authError.message },
      { status: 400 }
    )
  }

  // Create profile for first-admin
  await supabaseAdmin.from('profiles').upsert({
    id:    authData.user.id,
    name:  managerNameCn.trim(),
    email: managerEmail.trim().toLowerCase(),
    role:  'admin',
  })

  // Create group
  const { data: newGroup, error: groupError } = await supabaseAdmin
    .from('groups')
    .insert({
      name:             firmNameCn.trim(),
      description:      firmNameEn.trim(),
      firm_name_cn:     firmNameCn.trim(),
      firm_name_en:     firmNameEn.trim(),
      manager_name_cn:  managerNameCn.trim(),
      manager_name_en:  managerNameEn.trim(),
      subdomain,
    })
    .select('id')
    .single()

  if (groupError) {
    // Rollback: delete the auth user we just created
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: groupError.message }, { status: 400 })
  }

  // Add first-admin as group member
  const { error: memberError } = await supabaseAdmin.from('group_members').insert({
    group_id: newGroup.id,
    user_id:  authData.user.id,
    role:     'first_admin',
  })

  if (memberError) {
    return NextResponse.json({ error: '团队已创建，但关联管理员失败：' + memberError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, subdomain, groupId: newGroup.id })
}

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return '密码至少 8 位'
  if (!/^[A-Za-z]/.test(pwd)) return '密码必须以字母开头'
  if (!/[A-Z]/.test(pwd)) return '密码必须包含大写字母'
  if (!/[a-z]/.test(pwd)) return '密码必须包含小写字母'
  if (!/[0-9]/.test(pwd)) return '密码必须包含数字'
  if (!/[^A-Za-z0-9]/.test(pwd)) return '密码必须包含特殊字符'
  return null
}
