export const runtime = 'edge'

import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabase
    .from('profiles').select('is_super_admin').eq('id', userId).single()
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: '仅超级管理员可操作' }, { status: 403 })
  }

  const { adminUserId, newPassword } = await req.json()
  if (!adminUserId || !newPassword) return NextResponse.json({ error: '参数不完整' }, { status: 400 })

  const pwdError = validatePassword(newPassword)
  if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 })

  try {
    const clerk = await clerkClient()
    await clerk.users.updateUser(adminUserId, { password: newPassword })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.errors?.[0]?.message || err.message }, { status: 400 })
  }
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
