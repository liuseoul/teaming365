// Client-side only — never import from server components or edge routes.
// Dynamically imports @virgilsecurity/e3kit-browser to avoid SSR bundling.

import type { EThree, FindUsersResult } from '@virgilsecurity/e3kit-browser'

// ── Module-level singleton ────────────────────────────────────────────────────
let _instance: EThree | null = null
let _initPromise: Promise<EThree> | null = null

// ── Helpers that call our edge API endpoints ──────────────────────────────────
async function fetchVirgilJwt(userId: string): Promise<string> {
  const res = await fetch('/api/virgil/jwt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  const { token, error } = await res.json()
  if (error) throw new Error(`Virgil JWT error: ${error}`)
  return token
}

async function fetchBackupPwd(userId: string): Promise<string> {
  const res = await fetch('/api/virgil/backup-pwd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  const { pwd, error } = await res.json()
  if (error) throw new Error(`Virgil backup-pwd error: ${error}`)
  return pwd
}

// ── Main init function ────────────────────────────────────────────────────────
/**
 * Initialize E3Kit for the given user. Safe to call multiple times — returns
 * the cached instance after the first successful call.
 */
export async function initE3Kit(userId: string): Promise<EThree> {
  if (_instance) return _instance
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const { EThree } = await import('@virgilsecurity/e3kit-browser')

    const eThree = await EThree.initialize(() => fetchVirgilJwt(userId))

    const hasLocalKey = await eThree.hasLocalPrivateKey()

    if (!hasLocalKey) {
      // Check if this user already has a Virgil card (registered before)
      let isRegistered = false
      try {
        await eThree.findUsers(userId)
        isRegistered = true
      } catch {
        // UsersNotFoundError — new user
      }

      const backupPwd = await fetchBackupPwd(userId)

      if (isRegistered) {
        // Key exists in Virgil but not locally — restore from Keyknox backup
        try {
          await eThree.restorePrivateKey(backupPwd)
        } catch {
          // Backup not found (e.g. first login on new device after local storage clear)
          // Rotate to generate a fresh key, then re-backup
          await eThree.rotatePrivateKey()
          await eThree.backupPrivateKey(backupPwd)
        }
      } else {
        // Truly new user — register and back up
        await eThree.register()
        await eThree.backupPrivateKey(backupPwd)
      }
    }

    _instance = eThree
    return eThree
  })()

  return _initPromise
}

// ── Group helpers ─────────────────────────────────────────────────────────────
/**
 * Load an existing Virgil group. Returns null if the group hasn't been created yet.
 * @param groupId     Supabase group UUID (used as Virgil group identifier)
 * @param initiatorId Clerk userId of the first_admin who created the group
 */
export async function loadVirgilGroup(
  eThree: EThree,
  groupId: string,
  initiatorId: string
) {
  try {
    const initiatorCard = await eThree.findUsers(initiatorId)
    return await eThree.loadGroup(groupId, initiatorCard as FindUsersResult)
  } catch {
    return null
  }
}

/**
 * Create a new Virgil group. Call this once per app group, by the first_admin.
 * @param groupId Supabase group UUID
 */
export async function createVirgilGroup(eThree: EThree, groupId: string) {
  return await eThree.createGroup(groupId)
}

/**
 * Add a user to an existing Virgil group.
 * The caller must be an existing group member (typically first_admin).
 * Returns false if the new user is not yet registered with Virgil.
 */
export async function addUserToVirgilGroup(
  eThree: EThree,
  groupId: string,
  initiatorId: string,
  newUserId: string
): Promise<boolean> {
  try {
    const initiatorCard = await eThree.findUsers(initiatorId)
    const group = await eThree.loadGroup(groupId, initiatorCard as FindUsersResult)
    const newUserCard = await eThree.findUsers(newUserId)
    await group.add(newUserCard as FindUsersResult)
    return true
  } catch {
    // New user not registered with Virgil yet — will be added on their first login
    return false
  }
}

/**
 * Remove a user from a Virgil group.
 */
export async function removeUserFromVirgilGroup(
  eThree: EThree,
  groupId: string,
  initiatorId: string,
  userId: string
): Promise<void> {
  const initiatorCard = await eThree.findUsers(initiatorId)
  const group = await eThree.loadGroup(groupId, initiatorCard as FindUsersResult)
  const userCard = await eThree.findUsers(userId)
  await group.remove(userCard as FindUsersResult)
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────
/**
 * Encrypt a plaintext string for a Virgil group.
 * Returns the encrypted base64 string, or the original text on error.
 */
export async function encryptForGroup(
  eThree: EThree,
  groupId: string,
  initiatorId: string,
  plaintext: string
): Promise<string> {
  const group = await loadVirgilGroup(eThree, groupId, initiatorId)
  if (!group) return plaintext  // group not set up yet — store unencrypted for now
  return await group.encrypt(plaintext)
}

/**
 * Decrypt a string that was encrypted for a Virgil group.
 * Returns the original ciphertext (as-is) if decryption fails.
 */
export async function decryptFromGroup(
  eThree: EThree,
  groupId: string,
  initiatorId: string,
  authorId: string,
  ciphertext: string
): Promise<string> {
  try {
    const group = await loadVirgilGroup(eThree, groupId, initiatorId)
    if (!group) return ciphertext
    const authorCard = await eThree.findUsers(authorId)
    return await group.decrypt(ciphertext, authorCard as FindUsersResult)
  } catch {
    return ciphertext
  }
}

// ── Reset (for testing / logout) ──────────────────────────────────────────────
export function resetE3Kit() {
  _instance = null
  _initPromise = null
}
