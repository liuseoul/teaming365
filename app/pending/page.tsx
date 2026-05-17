'use client'
import { useState } from 'react'
import { useClerk, useAuth, useUser } from '@clerk/nextjs'

function BrandName() {
  return (
    <span className="text-2xl font-semibold">
      Team<span
        className="font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent"
        style={{ fontVariantNumeric: 'oldstyle-nums' }}
      >365</span>
    </span>
  )
}

export default function PendingPage() {
  const { signOut } = useClerk()
  const { userId } = useAuth()
  const { user } = useUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? ''

  // ── View state ────────────────────────────────────────────
  const [view, setView] = useState<'waiting' | 'join' | 'create'>('waiting')

  // ── Join by invitation state ──────────────────────────────
  const [joinGroupName, setJoinGroupName] = useState('')
  const [joinCode,      setJoinCode]      = useState('')
  const [joining,       setJoining]       = useState(false)
  const [joinMsg,       setJoinMsg]       = useState('')

  // ── Create-team inline form state ─────────────────────────
  const [groupNameCn,    setGroupNameCn]    = useState('')
  const [groupNameEn,    setGroupNameEn]    = useState('')
  const [managerNameEn,  setManagerNameEn]  = useState('')
  const [creating,       setCreating]       = useState(false)
  const [createMsg,      setCreateMsg]      = useState('')

  const previewSubdomain = (groupNameEn + managerNameEn)
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)

  async function handleJoin() {
    if (!joinGroupName.trim() || !joinCode.trim()) {
      setJoinMsg('❌ Both team name and code are required'); return
    }
    if (!userId) { setJoinMsg('❌ Auth service not ready — please refresh'); return }
    setJoining(true); setJoinMsg('')
    try {
      const res = await fetch('/api/auth/join-by-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId:   userId,
          groupName:     joinGroupName.trim(),
          code:          joinCode.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setJoinMsg(`❌ ${json.error || 'Join failed'}`); return }
      // Set qt_uid cookie so the server page never calls auth()
      document.cookie = `qt_uid=${encodeURIComponent(userId)}; path=/; max-age=86400; SameSite=Lax`
      window.location.href = `/${json.subdomain}/projects?_uid=${encodeURIComponent(userId)}`
    } catch {
      setJoinMsg('❌ Network error — please try again')
    } finally {
      setJoining(false)
    }
  }

  async function handleCreate() {
    if (!groupNameCn.trim() || !groupNameEn.trim() || !managerNameEn.trim()) {
      setCreateMsg('❌ All fields are required'); return
    }
    if (!userId) { setCreateMsg('❌ Auth service not ready — please refresh'); return }
    setCreating(true); setCreateMsg('')
    try {
      const res = await fetch('/api/auth/create-group-for-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId:   userId,
          groupNameCn:   groupNameCn.trim(),
          groupNameEn:   groupNameEn.trim(),
          managerNameEn: managerNameEn.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setCreateMsg(`❌ ${json.error || 'Creation failed'}`); return }
      // Set qt_uid cookie + _uid param so the server page never calls auth()
      document.cookie = `qt_uid=${encodeURIComponent(userId)}; path=/; max-age=86400; SameSite=Lax`
      window.location.href = `/${json.subdomain}/projects?_uid=${encodeURIComponent(userId ?? '')}`
    } catch {
      setCreateMsg('❌ Network error — please try again')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-600/20 border border-teal-500/30 mb-6">
          <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
        </div>

        {/* Brand */}
        <h1 className="text-white mb-1"><BrandName /></h1>

        {view === 'waiting' && (
          /* ── Waiting card ──────────────────────────────── */
          <div className="bg-white rounded-2xl shadow-2xl p-8 mt-6 space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 border border-amber-200 mx-auto">
              <span className="text-xl">⏳</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Account created — what would you like to do?</h2>
            {userEmail && (
              <p className="text-xs text-gray-400">Signed in as <span className="font-mono">{userEmail}</span></p>
            )}

            {/* Join by invitation */}
            <button
              onClick={() => setView('join')}
              className="w-full py-2.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            >
              Join a team with invitation code →
            </button>

            <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-400 text-left space-y-1">
              <p>✉️ Received an invitation? Click above</p>
              <p>🔑 Enter the team name and 6-digit code from your email</p>
              <p>✅ You&apos;ll be added to the team instantly</p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 text-gray-300">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Create team option */}
            <button
              onClick={() => setView('create')}
              className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            >
              Create my own team →
            </button>

            <button
              onClick={() => signOut({ redirectUrl: '/login' })}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}

        {view === 'join' && (
          /* ── Join by invitation card ───────────────────── */
          <div className="bg-white rounded-2xl shadow-2xl p-8 mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Join a team</h2>
            <p className="text-sm text-gray-500">
              Enter the team name and the 6-digit code from your invitation email.
            </p>

            <div className="space-y-3 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={joinGroupName}
                  onChange={e => setJoinGroupName(e.target.value)}
                  placeholder="e.g. Johnson & Partners"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invitation code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400 placeholder:tracking-normal placeholder:font-sans"
                />
              </div>

              {userEmail && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                  Joining as: <span className="font-mono">{userEmail}</span>
                </div>
              )}
            </div>

            {joinMsg && <p className="text-sm text-left">{joinMsg}</p>}

            <button onClick={handleJoin} disabled={joining}
              className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors">
              {joining ? 'Joining…' : 'Join team'}
            </button>
            <button onClick={() => { setView('waiting'); setJoinMsg('') }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Back
            </button>
          </div>
        )}

        {view === 'create' && (
          /* ── Create team card ──────────────────────────── */
          <div className="bg-white rounded-2xl shadow-2xl p-8 mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create my team</h2>
            <p className="text-sm text-gray-500">You&apos;ll be the team admin and can invite members.</p>

            <div className="space-y-3 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team name (local) <span className="text-red-500">*</span></label>
                <input type="text" value={groupNameCn} onChange={e => setGroupNameCn(e.target.value)}
                  placeholder="e.g. Johnson & Partners"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team name (English) <span className="text-red-500">*</span></label>
                <input type="text" value={groupNameEn} onChange={e => setGroupNameEn(e.target.value)}
                  placeholder="e.g. JohnsonPartners"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name in English <span className="text-red-500">*</span></label>
                <input type="text" value={managerNameEn} onChange={e => setManagerNameEn(e.target.value)}
                  placeholder="e.g. JohnSmith"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
              </div>

              {previewSubdomain && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 text-xs text-gray-600">
                  Team URL: <span className="font-mono font-semibold text-teal-700">teaming365.com/{previewSubdomain}</span>
                </div>
              )}
            </div>

            {createMsg && <p className="text-sm text-red-600 text-left">{createMsg}</p>}

            <button onClick={handleCreate} disabled={creating}
              className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors">
              {creating ? 'Creating…' : 'Create team'}
            </button>
            <button onClick={() => { setView('waiting'); setCreateMsg('') }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Back
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
