// Client-side E2E encryption — pure JavaScript NaCl (tweetnacl), no WASM.
// Keys are stored in Supabase; private keys are encrypted before storage.
//
// Security model:
//   - Each user has a Curve25519 keypair (NaCl box).
//   - Each group has a random 32-byte symmetric key (NaCl secretbox).
//   - The group key is distributed to each member encrypted in a NaCl box
//     (admin's ephemeral keypair → member's public key).
//   - Super admin has no row in group_keys → cannot decrypt any group content.
//   - Private keys are encrypted with PBKDF2(server-derived-password) before
//     being stored in Supabase, so the server never holds a plaintext key.

import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────────────────────
export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array }

// TypeScript 5.x Web Crypto types require ArrayBuffer-backed views (not SharedArrayBuffer).
// tweetnacl-util's decodeBase64 returns Uint8Array<ArrayBufferLike>.
// This helper slices into a plain ArrayBuffer so the type checker is satisfied.
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

// ── Module-level singletons ───────────────────────────────────────────────────
let _keyPair: KeyPair | null = null
let _initPromise: Promise<KeyPair> | null = null
const _groupKeyCache = new Map<string, Uint8Array>()

// ── Private key backup helpers ────────────────────────────────────────────────
async function fetchBackupPwd(userId: string): Promise<string> {
  const res = await fetch('/api/virgil/backup-pwd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  const { pwd, error } = await res.json()
  if (error) throw new Error(error)
  return pwd
}

async function deriveEncKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ab(salt), iterations: 200_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptPrivateKey(secretKey: Uint8Array, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const key  = await deriveEncKey(password, salt)
  const enc  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ab(iv) }, key, ab(secretKey))
  return JSON.stringify({
    salt: encodeBase64(salt),
    iv:   encodeBase64(iv),
    data: encodeBase64(new Uint8Array(enc)),
  })
}

async function decryptPrivateKey(json: string, password: string): Promise<Uint8Array | null> {
  try {
    const { salt, iv, data } = JSON.parse(json)
    const key = await deriveEncKey(password, decodeBase64(salt))
    const dec = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ab(decodeBase64(iv)) }, key, ab(decodeBase64(data))
    )
    return new Uint8Array(dec)
  } catch {
    return null
  }
}

// ── User key init (call once per session) ─────────────────────────────────────
/**
 * Initialise the current user's NaCl keypair.
 * - First login: generates a keypair, encrypts the private key, stores both in Supabase.
 * - Returning user: fetches the encrypted private key from Supabase and decrypts it.
 */
export async function initUserKeys(userId: string): Promise<KeyPair> {
  if (_keyPair)   return _keyPair
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const supabase = createClient()
    const pwd = await fetchBackupPwd(userId)

    const { data: row } = await supabase
      .from('user_keys')
      .select('public_key, encrypted_private_key')
      .eq('user_id', userId)
      .single()

    if (row?.encrypted_private_key) {
      const secretKey = await decryptPrivateKey(row.encrypted_private_key, pwd)
      if (secretKey) {
        _keyPair = { publicKey: decodeBase64(row.public_key), secretKey }
        return _keyPair
      }
    }

    // Generate fresh keypair
    const kp = nacl.box.keyPair()
    const encPriv = await encryptPrivateKey(kp.secretKey, pwd)
    await supabase.from('user_keys').upsert({
      user_id:               userId,
      public_key:            encodeBase64(kp.publicKey),
      encrypted_private_key: encPriv,
    })
    _keyPair = kp
    return _keyPair
  })()

  return _initPromise
}

// ── Group key management ──────────────────────────────────────────────────────
/**
 * Fetch and decrypt the group symmetric key for the current user.
 * Returns null if the user has not been added to the group yet.
 */
export async function getGroupKey(
  userId: string,
  groupId: string,
  keyPair: KeyPair
): Promise<Uint8Array | null> {
  if (_groupKeyCache.has(groupId)) return _groupKeyCache.get(groupId)!

  const supabase = createClient()
  const { data } = await supabase
    .from('group_keys')
    .select('admin_public_key, nonce, encrypted_key')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single()
  if (!data) return null

  const opened = nacl.box.open(
    decodeBase64(data.encrypted_key),
    decodeBase64(data.nonce),
    decodeBase64(data.admin_public_key),
    keyPair.secretKey
  )
  if (!opened) return null

  _groupKeyCache.set(groupId, opened)
  return opened
}

/**
 * Create a new random group key and distribute it (encrypted) to all supplied members.
 * Called by first_admin when setting up a new group.
 */
export async function createAndDistributeGroupKey(
  adminUserId: string,
  groupId: string,
  adminKeyPair: KeyPair,
  memberIds: string[]
): Promise<void> {
  const supabase  = createClient()
  const groupKey  = nacl.randomBytes(32)
  const allIds    = [...new Set([adminUserId, ...memberIds])]

  const { data: memberKeys } = await supabase
    .from('user_keys')
    .select('user_id, public_key')
    .in('user_id', allIds)
  if (!memberKeys) return

  const rows = memberKeys.map(m => {
    const nonce = nacl.randomBytes(24)
    const enc   = nacl.box(groupKey, nonce, decodeBase64(m.public_key), adminKeyPair.secretKey)
    return {
      group_id:         groupId,
      user_id:          m.user_id,
      admin_public_key: encodeBase64(adminKeyPair.publicKey),
      nonce:            encodeBase64(nonce),
      encrypted_key:    encodeBase64(enc),
    }
  })
  await supabase.from('group_keys').upsert(rows)
  _groupKeyCache.set(groupId, groupKey)
}

/**
 * Add a single new member to an existing group.
 * Returns false if the member hasn't registered their key yet.
 */
export async function addMemberToGroup(
  adminUserId: string,
  groupId: string,
  adminKeyPair: KeyPair,
  newMemberId: string
): Promise<boolean> {
  const supabase  = createClient()
  const groupKey  = await getGroupKey(adminUserId, groupId, adminKeyPair)
  if (!groupKey) return false

  const { data: mk } = await supabase
    .from('user_keys').select('public_key').eq('user_id', newMemberId).single()
  if (!mk) return false

  const nonce = nacl.randomBytes(24)
  const enc   = nacl.box(groupKey, nonce, decodeBase64(mk.public_key), adminKeyPair.secretKey)
  await supabase.from('group_keys').upsert({
    group_id:         groupId,
    user_id:          newMemberId,
    admin_public_key: encodeBase64(adminKeyPair.publicKey),
    nonce:            encodeBase64(nonce),
    encrypted_key:    encodeBase64(enc),
  })
  return true
}

/**
 * Remove a member's group key entry (call after removing from group_members).
 */
export async function removeMemberFromGroup(
  groupId: string,
  userId: string
): Promise<void> {
  const supabase = createClient()
  await supabase.from('group_keys').delete()
    .eq('group_id', groupId).eq('user_id', userId)
}

// ── Content encrypt / decrypt ─────────────────────────────────────────────────
/**
 * Encrypt a UTF-8 string with the group's symmetric key.
 * Returns a base64 string: base64(nonce[24] + ciphertext).
 */
export function encryptText(plaintext: string, groupKey: Uint8Array): string {
  const nonce     = nacl.randomBytes(24)
  const encrypted = nacl.secretbox(decodeUTF8(plaintext), nonce, groupKey)
  const combined  = new Uint8Array(24 + encrypted.length)
  combined.set(nonce)
  combined.set(encrypted, 24)
  return encodeBase64(combined)
}

/**
 * Decrypt a base64 ciphertext string (produced by encryptText).
 * Returns the plaintext string, or null if decryption fails.
 */
export function decryptText(ciphertext: string, groupKey: Uint8Array): string | null {
  try {
    const combined  = decodeBase64(ciphertext)
    const nonce     = combined.slice(0, 24)
    const encrypted = combined.slice(24)
    const decrypted = nacl.secretbox.open(encrypted, nonce, groupKey)
    return decrypted ? encodeUTF8(decrypted) : null
  } catch {
    return null
  }
}

// ── Reset (on logout) ─────────────────────────────────────────────────────────
export function resetE2E(): void {
  _keyPair     = null
  _initPromise = null
  _groupKeyCache.clear()
}
