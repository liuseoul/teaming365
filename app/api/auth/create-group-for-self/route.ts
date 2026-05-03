export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { clerkUserId, groupNameCn, groupNameEn, managerNameEn } = body

  if (!clerkUserId || !groupNameCn?.trim() || !groupNameEn?.trim() || !managerNameEn?.trim()) {
    return NextResponse.json({ error: '所有字段均为必填' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('id, name').eq('id', clerkUserId).single()
  if (!profile) return NextResponse.json({ error: '用户不存在，请重新登录' }, { status: 404 })

  const subdomain = (groupNameEn.trim() + managerNameEn.trim())
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  if (!subdomain) return NextResponse.json({ error: '英文名称必须包含字母或数字' }, { status: 400 })

  const { data: existing } = await supabase
    .from('groups').select('id').eq('subdomain', subdomain).maybeSingle()
  if (existing) return NextResponse.json({ error: `路径"${subdomain}"已被占用，请修改英文名称` }, { status: 400 })

  const { data: newGroup, error: groupError } = await supabase
    .from('groups')
    .insert({
      name:            groupNameCn.trim(),
      description:     groupNameEn.trim(),
      firm_name_cn:    groupNameCn.trim(),
      firm_name_en:    groupNameEn.trim(),
      manager_name_cn: profile.name,
      manager_name_en: managerNameEn.trim(),
      subdomain,
    })
    .select('id').single()

  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 400 })

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: newGroup.id,
    user_id:  clerkUserId,
    role:     'first_admin',
  })

  if (memberError) {
    return NextResponse.json({ error: '团队已创建，但设置管理员失败：' + memberError.message }, { status: 400 })
  }

  await supabase.from('profiles').update({ role: 'admin' }).eq('id', clerkUserId)

  return NextResponse.json({ ok: true, subdomain, groupId: newGroup.id })
}
