export const runtime = 'edge'

/**
 * Send a team invitation email with a random 6-digit code.
 *
 * Required Supabase table (run once in your DB):
 *
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
 *
 * Required env vars:
 *   RESEND_API_KEY  — from resend.com
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

  // Fetch group name for the email
  const { data: group } = await supabase
    .from('groups').select('name').eq('id', groupId).single()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const normalizedEmail = email.trim().toLowerCase()

  // Generate a 6-digit numeric code
  const code = String(Math.floor(100000 + Math.random() * 900000))

  // Upsert invitation — replaces any existing pending invite for this email+group
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

  // Send email via Resend REST API
  const emailBody = {
    from:    'Teaming365 <noreply@teaming365.com>',
    to:      normalizedEmail,
    subject: `You've been invited to join ${group.name} on Teaming365`,
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
  <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">You're invited!</h1>
  <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
    You have been invited to join <strong>${group.name}</strong> on <strong>Teaming365</strong>.
  </p>

  <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
    <p style="margin:0 0 10px;font-size:11px;color:#0d9488;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Your invitation details</p>
    <p style="margin:0 0 8px;font-size:14px;color:#374151;">Team name: <strong>${group.name}</strong></p>
    <p style="margin:0;font-size:14px;color:#374151;">
      Invitation code:
      <strong style="display:inline-block;margin-left:8px;font-size:30px;letter-spacing:0.18em;color:#0d9488;font-weight:700;">${code}</strong>
    </p>
  </div>

  <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 6px;">How to join:</p>
  <ol style="color:#6b7280;font-size:14px;line-height:1.9;padding-left:18px;margin:0 0 28px;">
    <li>Go to <a href="https://teaming365.com/login" style="color:#0d9488;text-decoration:none;">teaming365.com/login</a> and register using <strong>${normalizedEmail}</strong></li>
    <li>After signing up, choose <em>"Join a team by invitation"</em></li>
    <li>Enter the team name and the 6-digit code above</li>
  </ol>

  <p style="color:#9ca3af;font-size:12px;margin:0;">This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
</div>
`,
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(emailBody),
  })

  if (!emailRes.ok) {
    const errJson = await emailRes.json().catch(() => ({}))
    const errMsg  = (errJson as any).message || `HTTP ${emailRes.status}`
    return NextResponse.json(
      { error: `Invitation saved but email failed to send: ${errMsg}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
