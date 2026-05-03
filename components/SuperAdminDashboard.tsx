'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'

function generatePassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$%&*'
  const all     = upper + lower + digits + special

  const rand = (s: string) => s[Math.floor(Math.random() * s.length)]
  // Guaranteed components
  const mandatory = [rand(lower), rand(digits), rand(special)]
  // Fill to 10 chars
  const filler = Array.from({ length: 6 }, () => rand(all))
  const rest = [...mandatory, ...filler]
  // Fisher-Yates shuffle
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return rand(upper) + rest.join('') // Always starts with uppercase letter
}

const ROLE_LABELS: Record<string, string> = {
  first_admin:  'Primary Admin',
  second_admin: 'Secondary Admin',
  member:       'Member',
}
const ROLE_COLORS: Record<string, string> = {
  first_admin:  'bg-purple-100 text-purple-700',
  second_admin: 'bg-blue-100 text-blue-700',
  member:       'bg-gray-100 text-gray-600',
}

export default function SuperAdminDashboard({
  profile,
  groups,
  pendingUsers,
  allUsers,
}: {
  profile: { id: string; name: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groups: any[]
  pendingUsers: { id: string; name: string; email: string; created_at: string }[]
  allUsers: { id: string; name: string; email: string; created_at: string; teamName: string | null; role: string | null }[]
}) {
  const router = useRouter()
  const { signOut } = useClerk()

  // ── Tab state ───────────────────────────────────────────────
  const [tab, setTab] = useState<'groups' | 'pending' | 'users'>('groups')

  // ── All Users search ────────────────────────────────────────
  const [userSearch, setUserSearch] = useState('')

  // ── Password reset state ────────────────────────────────────
  const [resetGroupId,  setResetGroupId]  = useState('')
  const [resetAdminId,  setResetAdminId]  = useState('')
  const [resetPwd,      setResetPwd]      = useState('')
  const [showResetPwd,  setShowResetPwd]  = useState(false)
  const [resetSaving,   setResetSaving]   = useState(false)
  const [resetMsg,      setResetMsg]      = useState('')

  async function handleResetPwd() {
    setResetMsg('')
    if (!resetAdminId || !resetPwd) {
      setResetMsg('❌ Select a team and enter a new password')
      return
    }
    setResetSaving(true)
    try {
      const res = await fetch('/api/super-admin/reset-first-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerUserId: profile.id, adminUserId: resetAdminId, newPassword: resetPwd }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResetMsg(`❌ ${json.error || 'Operation failed'}`)
      } else {
        setResetMsg('✅ Password reset')
        setResetGroupId(''); setResetAdminId(''); setResetPwd(''); setShowResetPwd(false)
      }
    } catch {
      setResetMsg('❌ Network error — please try again')
    } finally {
      setResetSaving(false)
    }
  }

  function handleGroupSelect(gid: string) {
    setResetGroupId(gid)
    // Find first-admin of this group
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = groups.find((x: any) => x.id === gid)
    if (g?.group_members?.[0]?.user_id) {
      setResetAdminId(g.group_members[0].user_id)
    } else {
      setResetAdminId('')
    }
    setResetMsg('')
  }

  async function handleLogout() {
    document.cookie = 'qt_group=; path=/; max-age=0'
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-sm font-bold text-white">Q</div>
          <div>
            <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
              Team<span className="font-black bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent" style={{fontVariantNumeric:'oldstyle-nums'}}>365</span>
              <span className="text-gray-400 font-normal ml-1">· Super Admin</span>
            </div>
            <div className="text-xs text-gray-400">{profile.name}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          Sign out
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {(['groups', 'users', 'pending'] as const).map(key => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${tab === key ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {key === 'groups' ? 'All Teams'
              : key === 'users' ? `All Users (${allUsers.length})`
              : `Pending (${pendingUsers.length})`}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {tab === 'groups' && (
          <>
            {/* ── Group List ──────────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                All Teams <span className="text-gray-400 font-normal text-sm">({groups.length})</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-2 text-xs font-medium text-gray-500">Organization</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">Manager</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">Email</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">URL Path</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 text-right">Members</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 text-right">Matters</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g: any) => {
                      const admin = g.group_members?.[0]
                      return (
                        <tr key={g.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 font-medium text-gray-900">
                            <div>{g.firm_name_cn || g.name}</div>
                            {g.firm_name_en && <div className="text-xs text-gray-400">{g.firm_name_en}</div>}
                          </td>
                          <td className="py-3 text-gray-700">
                            <div>{g.manager_name_cn || admin?.profiles?.name || '—'}</div>
                            {g.manager_name_en && <div className="text-xs text-gray-400">{g.manager_name_en}</div>}
                          </td>
                          <td className="py-3 text-gray-500 text-xs">{admin?.profiles?.email || '—'}</td>
                          <td className="py-3">
                            {g.subdomain
                              ? <span className="font-mono text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded">/{g.subdomain}</span>
                              : <span className="text-gray-400 text-xs">—</span>
                            }
                          </td>
                          <td className="py-3 text-gray-700 text-sm text-right">{g.memberCount}</td>
                          <td className="py-3 text-gray-700 text-sm text-right">{g.projectCount}</td>
                          <td className="py-3 text-gray-400 text-xs">
                            {new Date(g.created_at).toLocaleDateString('en-US')}
                          </td>
                        </tr>
                      )
                    })}
                    {groups.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">No teams yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Password Reset ──────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Reset Admin Password</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Select a team</label>
                  <select value={resetGroupId} onChange={e => handleGroupSelect(e.target.value)} className="input-field">
                    <option value="">— Select team —</option>
                    {groups.map((g: any) => (
                      <option key={g.id} value={g.id}>{g.firm_name_cn || g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">New password</label>
                  <div className="relative">
                    <input
                      type={showResetPwd ? 'text' : 'password'}
                      value={resetPwd}
                      onChange={e => setResetPwd(e.target.value)}
                      placeholder="Min 8 characters"
                      className="input-field pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">
                      {showResetPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
              {resetMsg && <p className="mt-3 text-sm">{resetMsg}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={handleResetPwd} disabled={resetSaving} className="btn-primary">
                  {resetSaving ? 'Processing…' : 'Reset password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = generatePassword()
                    setResetPwd(p)
                    setShowResetPwd(true)
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium">
                  Generate password
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'users' && (
          /* ── All Users ───────────────────────────────────────── */
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                All Users <span className="text-gray-400 font-normal text-sm">({allUsers.length})</span>
              </h2>
              <input
                type="text"
                placeholder="Search name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="input-field w-56 text-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 text-xs font-medium text-gray-500">Name</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">Email</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">Team</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">Role</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers
                    .filter(u =>
                      !userSearch ||
                      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearch.toLowerCase())
                    )
                    .map(u => (
                      <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{u.name}</td>
                        <td className="py-3 text-gray-500 text-xs">{u.email}</td>
                        <td className="py-3 text-gray-700 text-xs">
                          {u.teamName
                            ? <span className="font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{u.teamName}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3">
                          {u.role
                            ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                                {ROLE_LABELS[u.role] || u.role}
                              </span>
                            : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Pending</span>}
                        </td>
                        <td className="py-3 text-gray-400 text-xs">
                          {new Date(u.created_at).toLocaleDateString('en-US')}
                        </td>
                      </tr>
                    ))}
                  {allUsers.filter(u =>
                    !userSearch ||
                    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearch.toLowerCase())
                  ).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'pending' && (
          /* ── Pending Users ───────────────────────────────────── */
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              Pending Users <span className="text-gray-400 font-normal text-sm">({pendingUsers.length})</span>
            </h2>
            <p className="text-xs text-gray-500 mb-5">These users have registered but haven&apos;t joined any team yet. Team admins can add them by email.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 text-xs font-medium text-gray-500">Name</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">Email</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="py-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="py-3 text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('en-US')}
                      </td>
                    </tr>
                  ))}
                  {pendingUsers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400 text-sm">No pending users</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
