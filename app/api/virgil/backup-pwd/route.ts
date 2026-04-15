// Returns a deterministic backup password for Virgil Keyknox.
// Derived via HMAC-SHA256(APP_ID:API_KEY_ID, userId) — no extra env var needed.
// This lets keys restore automatically across devices without user prompts.
export const runtime = 'edge'

import { NextResponse } from 'next/server'

const APP_ID     = process.env.VIRGIL_APP_ID!
const API_KEY_ID = process.env.VIRGIL_API_KEY_ID!

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'missing userId' }, { status: 400 })

    const enc = new TextEncoder()
    const keyMat = enc.encode(`${APP_ID}:${API_KEY_ID}`)
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyMat, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(userId))
    const pwd = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return NextResponse.json({ pwd })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
