// Generates a short-lived Virgil JWT for the given userId.
// Signed with our Ed25519 API key using Web Crypto (edge-compatible).
export const runtime = 'edge'

import { NextResponse } from 'next/server'

const APP_ID       = process.env.VIRGIL_APP_ID!
const API_KEY_ID   = process.env.VIRGIL_API_KEY_ID!
const PRIV_KEY_B64 = process.env.VIRGIL_API_PRIVATE_KEY!  // raw base64 PKCS#8 DER

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  bytes.forEach(b => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'missing userId' }, { status: 400 })

    const now = Math.floor(Date.now() / 1000)

    const header = {
      alg: 'VEDS512',
      kid: API_KEY_ID,
      typ: 'JWT',
      cty: 'virgil-jwt;v=1',
    }
    const payload = {
      iss: `virgil;${APP_ID}`,
      sub: `identity;${userId}`,
      iat: now,
      exp: now + 3600,
    }

    const enc = new TextEncoder()
    const hB64 = b64url(enc.encode(JSON.stringify(header)))
    const pB64 = b64url(enc.encode(JSON.stringify(payload)))
    const sigInput = `${hB64}.${pB64}`

    // Import PKCS#8 Ed25519 private key
    const pkcs8 = Uint8Array.from(atob(PRIV_KEY_B64), c => c.charCodeAt(0))
    const privKey = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8.buffer as ArrayBuffer,
      { name: 'Ed25519' },
      false,
      ['sign']
    )

    const sig = await crypto.subtle.sign('Ed25519', privKey, enc.encode(sigInput))
    return NextResponse.json({ token: `${sigInput}.${b64url(sig)}` })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
