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

  const { memberId, newPassword, groupId } = await req.json()

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

  if (!memberId || !newPassword) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(memberId, {
    password: newPassword,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
