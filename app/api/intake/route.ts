export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { subdomain, name, email, phone, matterType, description } = body

  if (!subdomain) return NextResponse.json({ error: 'Missing subdomain' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data: group } = await supabase
    .from('groups').select('id').eq('subdomain', subdomain).single()
  if (!group) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const { error } = await supabase.from('intake_submissions').insert({
    group_id:    group.id,
    name:        name.trim(),
    email:       email?.trim() || null,
    phone:       phone?.trim() || null,
    matter_type: matterType || null,
    description: description?.trim() || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
