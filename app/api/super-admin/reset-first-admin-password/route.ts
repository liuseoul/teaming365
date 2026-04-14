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

  const { adminUserId, newPassword } = await req.json()

  if (!adminUserId || !newPassword) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  }

  const pwdError = validatePassword(newPassword)
  if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 })

  const { error } = await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
    password: newPassword,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
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
