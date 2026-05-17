export const runtime = 'edge'

/**
 * Let a newly registered user join a group using the invitation code
 * that was emailed to them.
 *
 * Match criteria (all must be satisfied):
 *   - invitation.email  == user's registered email (from profiles table)
 *   - group.name        == groupName input (case-insensitive)
 *   - invitation.code   == code input
 *   - invitation.used_at IS NULL  (not already used)
 *   - invitation.expires_at > now()
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { clerkUserId, groupName, code } = await req.json()

  if (!clerkUserId || !groupName?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  // Get user's email from profiles (stored at registration)
  const { data: profile } = await supabase
    .from('profiles').select('id, email')
    .eq('id', clerkUserId).single()

  if (!profile?.email) {
    return NextResponse.json(
      { error: 'Profile not found — please try signing out and back in' },
      { status: 404 }
    )
  }

  const userEmail = profile.email.toLowerCase()

  // Find group by name (case-insensitive)
  const { data: group } = await supabase
    .from('groups').select('id, name, subdomain')
    .ilike('name', groupName.trim())
    .single()

  if (!group) {
    return NextResponse.json(
      { error: 'Team not found. Please check the team name and try again.' },
      { status: 404 }
    )
  }

  // Find a valid, unused invitation matching email + group + code
  const { data: invitation } = await supabase
    .from('group_invitations')
    .select('id, role, title')
    .eq('group_id', group.id)
    .eq('email', userEmail)
    .eq('code', code.trim())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invitation) {
    return NextResponse.json(
      { error: 'Invalid or expired invitation code. Please ask your admin to resend the invitation.' },
      { status: 400 }
    )
  }

  // Add user to group_members
  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id:  clerkUserId,
    role:     invitation.role || 'member',
    title:    invitation.title || null,
  })

  if (memberError) {
    if (memberError.code === '23505') {
      return NextResponse.json(
        { error: 'You are already a member of this team.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Mark invitation as used
  await supabase
    .from('group_invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return NextResponse.json({ ok: true, subdomain: group.subdomain })
}
