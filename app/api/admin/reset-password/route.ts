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

  const { memberId, newPassword, groupId } = await req.json()
  if (!groupId) return NextResponse.json({ error: '缺少团队参数' }, { status: 400 })

  const { data: caller } = await supabase
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', userId).single()

  if (!caller || !['first_admin', 'second_admin'].includes(caller.role)) {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 })
  }
  if (!memberId || !newPassword) return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  if (newPassword.length < 6) return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 })

  try {
    const clerk = await clerkClient()
    await clerk.users.updateUser(memberId, { password: newPassword })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.errors?.[0]?.message || err.message }, { status: 400 })
  }
}
