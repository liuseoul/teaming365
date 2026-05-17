export const runtime = 'edge'

/**
 * Create a team invitation with a random 6-digit code.
 * The code is returned to the admin to share manually (no email required).
 *
 * Required Supabase table:
 *   CREATE TABLE group_invitations (
 *     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
 *     email      text NOT NULL,
 *     code       text NOT NULL,
 *     role       text NOT NULL DEFAULT 'member',
 *     title      text,
 *     created_at timestamptz NOT NULL DEFAULT now(),
 *     expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
 *     used_at    timestamptz,
 *     UNIQUE (group_id, email)
 *   );
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { callerUserId, email, role, title, groupId } = await req.json()

  if (!callerUserId || !email?.trim() || !groupId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify caller is an admin of this group
  const { data: callerMember } = await supabase
    .from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', callerUserId).single()

  if (!callerMember || !['first_admin', 'second_admin'].includes(callerMember.role)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  // Fetch group name
  const { data: group } = await supabase
    .from('groups').select('name').eq('id', groupId).single()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const normalizedEmail = email.trim().toLowerCase()

  // Generate a 6-digit numeric code
  const code = String(Math.floor(100000 + Math.random() * 900000))

  // Upsert — replaces any existing pending invite for this email+group
  const { error: invError } = await supabase.from('group_invitations').upsert(
    {
      group_id:   groupId,
      email:      normalizedEmail,
      code,
      role:       role || 'member',
      title:      title || null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      used_at:    null,
    },
    { onConflict: 'group_id,email' }
  )

  if (invError) {
    return NextResponse.json(
      { error: `Failed to save invitation: ${invError.message}` },
      { status: 500 }
    )
  }

  // Return the code to the admin — no email service needed
  return NextResponse.json({ ok: true, code, groupName: group.name })
}
