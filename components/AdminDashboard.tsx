'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import {
  createAndDistributeGroupKey,
  getGroupKey,
  addMemberToGroup,
  removeMemberFromGroup,
  encField,
  decField,
} from '@/lib/e2e'

const STATUS_LABELS: Record<string, string> = {
  active:    'Active',
  delayed:   'Cancelled',
  completed: 'Closed',
  cancelled: 'Declined',
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

export default function AdminDashboard({
  profile, projects, members, groupId, group, subdomain,
}: {
  profile: any
  projects: any[]
  members: any[]
  groupId: string
  group: { id: string; name: string; description: string }
  subdomain: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const isFirstAdmin = profile?.role === 'first_admin'
  const [tab, setTab] = useState<'projects' | 'members'>('projects')

  // ── E2E encryption (NaCl) ───────────────────────────────────
  const { keyPair, ready: e2eReady } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)
  const [groupKeyReady, setGroupKeyReady] = useState(false)

  // Decrypt project list for display
  const [displayProjects, setDisplayProjects] = useState<any[]>(projects)
  useEffect(() => {
    if (!groupKey) return
    setDisplayProjects(projects.map((p: any) => ({
      ...p,
      name:   decField(p.name, groupKey),
      client: decField(p.client, groupKey),
    })))
  }, [groupKey, projects])

  // first_admin: create group key if missing, then add any registered members
  useEffect(() => {
    if (!keyPair || !e2eReady || !isFirstAdmin) return

    const adminId = profile.id as string
    ;(async () => {
      // Check if group key already exists for admin
      const existing = await getGroupKey(adminId, groupId, keyPair).catch(() => null)
      if (!existing) {
        // First time — generate and distribute group key to all registered members
        const memberIds = members.filter((m: any) => m.id !== adminId).map((m: any) => m.id)
        await createAndDistributeGroupKey(adminId, groupId, keyPair, memberIds)
      }
      setGroupKeyReady(true)

      // Silently add any registered members who don't have the group key yet
      for (const m of members) {
        if (m.id !== adminId) {
          await addMemberToGroup(adminId, groupId, keyPair, m.id).catch(() => {})
        }
      }
    })().catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyPair, e2eReady, isFirstAdmin])

  // ── New matter ────────────────────────────────────────────
  const [projName,       setProjName]       = useState('')
  const [projClient,     setProjClient]     = useState('')
  const [projDesc,       setProjDesc]       = useState('')
  const [projStatus,     setProjStatus]     = useState('active')
  const [projMatterType, setProjMatterType] = useState('')
  const [projAgreement,  setProjAgreement]  = useState('')
  const [projCurrency,   setProjCurrency]   = useState('CNY')
  const [projAmount,     setProjAmount]     = useState('')
  const [collabParties,  setCollabParties]  = useState([''])
  const [projSaving,    setProjSaving]    = useState(false)
  const [projMsg,       setProjMsg]       = useState('')

  // ── New member ────────────────────────────────────────────
  const [memName,     setMemName]     = useState('')
  const [memEmail,    setMemEmail]    = useState('')
  const [memPassword, setMemPassword] = useState('')
  const [showMemPwd,  setShowMemPwd]  = useState(false)
  const [memRole,     setMemRole]     = useState('member')
  const [memSaving,   setMemSaving]   = useState(false)
  const [memMsg,      setMemMsg]      = useState('')

  // ── Add existing user ─────────────────────────────────────
  const [addEmail,   setAddEmail]   = useState('')
  const [addRole,    setAddRole]    = useState('member')
  const [addSaving,  setAddSaving]  = useState(false)
  const [addMsg,     setAddMsg]     = useState('')

  // ── Reset password ────────────────────────────────────────
  const [resetId,       setResetId]       = useState('')
  const [resetPwd,      setResetPwd]      = useState('')
  const [showResetPwd,  setShowResetPwd]  = useState(false)
  const [resetSaving,   setResetSaving]   = useState(false)
  const [resetMsg,      setResetMsg]      = useState('')

  // ── Remove member ─────────────────────────────────────────
  const [removeSaving, setRemoveSaving] = useState<string | null>(null)
  const [removeMsg,    setRemoveMsg]    = useState('')

  function addCollabParty() { setCollabParties([...collabParties, '']) }
  function updateCollabParty(i: number, v: string) {
    const u = [...collabParties]; u[i] = v; setCollabParties(u)
  }
  function removeCollabParty(i: number) {
    if (collabParties.length === 1) return
    setCollabParties(collabParties.filter((_, j) => j !== i))
  }

  async function createProject() {
    if (!projName.trim() || !projClient.trim()) { setProjMsg('❌ Matter name and client are required'); return }
    setProjSaving(true); setProjMsg('')
    const parties = collabParties.map(p => p.trim()).filter(Boolean)
    const { error } = await supabase.from('projects').insert({
      name:                  encField(projName.trim(), groupKey) ?? projName.trim(),
      client:                encField(projClient.trim(), groupKey) ?? projClient.trim(),
      description:           encField(projDesc.trim() || null, groupKey),
      status:                projStatus,
      matter_type:           projMatterType || null,
      agreement_party:       encField(projAgreement || null, groupKey),
      service_fee_currency:  projCurrency,
      service_fee_amount:    projAmount ? parseFloat(projAmount) : null,
      collaboration_parties: parties.map((p: string) => encField(p, groupKey) ?? p),
      group_id:              groupId,
      created_by:            profile.id,
    })
    if (error) {
      setProjMsg(`❌ Creation failed: ${error.message}`)
    } else {
      setProjMsg('✅ Matter created')
      setProjName(''); setProjClient(''); setProjDesc('')
      setProjStatus('active'); setProjMatterType(''); setProjAgreement('')
      setProjCurrency('CNY'); setProjAmount(''); setCollabParties([''])
      setTimeout(() => router.refresh(), 800)
    }
    setProjSaving(false)
  }

  async function addExistingMember() {
    if (!addEmail.trim()) { setAddMsg('❌ Please enter an email'); return }
    setAddSaving(true); setAddMsg('')
    const res = await fetch('/api/admin/add-existing-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callerUserId: profile.id, email: addEmail.trim(), role: addRole, groupId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setAddMsg(`❌ ${json.error || 'Operation failed'}`)
    } else {
      // Try to add to E2E group key
      if (keyPair && isFirstAdmin && json.userId) {
        addMemberToGroup(profile.id as string, groupId, keyPair, json.userId).catch(() => {})
      }
      setAddMsg(`✅ Added "${json.name}" to the team`)
      setAddEmail('')
      setTimeout(() => router.refresh(), 800)
    }
    setAddSaving(false)
  }

  async function createMember() {
    if (!memName.trim() || !memEmail.trim() || !memPassword) {
      setMemMsg('❌ Name, email and password are required'); return
    }
    setMemSaving(true); setMemMsg('')
    const res = await fetch('/api/admin/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callerUserId: profile.id, name: memName.trim(), email: memEmail.trim(), password: memPassword, role: memRole, groupId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMemMsg(`❌ ${json.error || 'Creation failed'}`)
    } else {
      // Try to add the new member to the E2E group key immediately.
      // No-ops if the member hasn't registered their key yet (they will on first login).
      if (keyPair && isFirstAdmin && json.newUserId) {
        addMemberToGroup(profile.id as string, groupId, keyPair, json.newUserId).catch(() => {})
      }
      setMemMsg('✅ Member created')
      setMemName(''); setMemEmail(''); setMemPassword(''); setMemRole('member')
      setTimeout(() => router.refresh(), 800)
    }
    setMemSaving(false)
  }

  async function resetPassword() {
    if (!resetId || !resetPwd) { setResetMsg('❌ Select a member and enter a new password'); return }
    if (resetPwd.length < 6) { setResetMsg('❌ Min 6 characters'); return }
    setResetSaving(true); setResetMsg('')
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callerUserId: profile.id, memberId: resetId, newPassword: resetPwd, groupId }),
    })
    const json = await res.json()
    if (!res.ok) { setResetMsg(`❌ ${json.error || 'Operation failed'}`) }
    else { setResetMsg('✅ Password reset'); setResetId(''); setResetPwd('') }
    setResetSaving(false)
  }

  async function removeMember(memberId: string, memberName: string) {
    if (!confirm(`Remove "${memberName}" from the team? This cannot be undone.`)) return
    setRemoveSaving(memberId); setRemoveMsg('')
    const res = await fetch('/api/admin/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callerUserId: profile.id, memberId, groupId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setRemoveMsg(`❌ ${json.error || 'Operation failed'}`)
    } else {
      // Remove from E2E group key table in background
      if (isFirstAdmin) {
        removeMemberFromGroup(groupId, memberId).catch(() => {})
      }
      setTimeout(() => router.refresh(), 400)
    }
    setRemoveSaving(null)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} groupId={groupId} groupName={group.name} subdomain={subdomain} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Admin</h1>
          <span className="ml-3 text-sm text-gray-400">· {group.name}</span>
          <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[profile?.role] || ''}`}>
            {ROLE_LABELS[profile?.role] || profile?.role}
          </span>
        </div>

        <div className="flex border-b border-gray-200 bg-white px-6 flex-shrink-0">
          {(['projects', 'members'] as const).map(key => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab === key ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {key === 'projects' ? 'Matters' : 'Members'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ──────── Matters ──────── */}
          {tab === 'projects' && (
            <div className="max-w-3xl space-y-6">
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Create matter</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm text-gray-700 mb-1">Matter name *</label>
                    <input value={projName} onChange={e => setProjName(e.target.value)}
                      placeholder="Matter name" className="input-field" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm text-gray-700 mb-1">Client *</label>
                    <input value={projClient} onChange={e => setProjClient(e.target.value)}
                      placeholder="Client name" className="input-field" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm text-gray-700 mb-1">Matter type</label>
                    <select value={projMatterType} onChange={e => setProjMatterType(e.target.value)} className="input-field">
                      <option value="">Select (optional)</option>
                      <option value="criminal">Criminal</option>
                      <option value="corporate">Corporate</option>
                      <option value="family">Family</option>
                      <option value="ip">IP</option>
                      <option value="real_estate">Real Estate</option>
                      <option value="labor">Labor</option>
                      <option value="administrative">Administrative</option>
                      <option value="civil">Civil</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Notes</label>
                    <textarea value={projDesc} onChange={e => setProjDesc(e.target.value)}
                      placeholder="Brief description (optional)" rows={2} className="input-field resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Status</label>
                    <select value={projStatus} onChange={e => setProjStatus(e.target.value)} className="input-field">
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Declined</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Counterparty</label>
                    <input value={projAgreement} onChange={e => setProjAgreement(e.target.value)}
                      placeholder="Counterparty (optional)" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Fee currency</label>
                    <select value={projCurrency} onChange={e => setProjCurrency(e.target.value)} className="input-field">
                      <option value="CNY">CNY</option>
                      <option value="KRW">KRW</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Fee amount</label>
                    <input type="number" min="0" step="0.01" value={projAmount}
                      onChange={e => setProjAmount(e.target.value)} placeholder="Optional" className="input-field" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Co-counsel</label>
                    <div className="space-y-2">
                      {collabParties.map((party, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input value={party} onChange={e => updateCollabParty(i, e.target.value)}
                            placeholder={`Co-counsel ${i + 1}`} className="input-field flex-1" />
                          {collabParties.length > 1 && (
                            <button onClick={() => removeCollabParty(i)}
                              className="text-gray-400 hover:text-red-500 text-lg leading-none px-1" title="Remove">×</button>
                          )}
                        </div>
                      ))}
                      <button onClick={addCollabParty}
                        className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 font-medium">
                        <span className="text-lg leading-none">+</span> Add co-counsel
                      </button>
                    </div>
                  </div>
                </div>
                {projMsg && <p className="mt-3 text-sm">{projMsg}</p>}
                <button onClick={createProject} disabled={projSaving} className="mt-4 btn-primary">
                  {projSaving ? 'Creating…' : 'Create matter'}
                </button>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Matters <span className="text-gray-400 font-normal text-sm">({displayProjects.length})</span>
                </h2>
                <div className="space-y-2">
                  {displayProjects.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">Client: {p.client}</div>
                      </div>
                      <span className={`status-tag st-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                    </div>
                  ))}
                  {displayProjects.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No matters yet</p>}
                </div>
              </section>
            </div>
          )}

          {/* ──────── Members ──────── */}
          {tab === 'members' && (
            <div className="max-w-3xl space-y-6">
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Add existing user</h3>
                <p className="text-xs text-gray-500 mb-4">If they've already registered, add them to your team by email.</p>
                <div className="flex gap-3">
                  <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                    placeholder="Their registered email" className="input-field flex-1" />
                  {isFirstAdmin && (
                    <select value={addRole} onChange={e => setAddRole(e.target.value)} className="input-field w-36">
                      <option value="member">Member</option>
                      <option value="second_admin">Secondary Admin</option>
                    </select>
                  )}
                  <button onClick={addExistingMember} disabled={addSaving} className="btn-primary whitespace-nowrap">
                    {addSaving ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {addMsg && <p className="mt-2 text-sm">{addMsg}</p>}
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Create member</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Name *</label>
                    <input value={memName} onChange={e => setMemName(e.target.value)}
                      placeholder="Display name" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Email *</label>
                    <input type="email" value={memEmail} onChange={e => setMemEmail(e.target.value)}
                      placeholder="member@example.com" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Password *</label>
                    <div className="relative">
                      <input type={showMemPwd ? 'text' : 'password'} value={memPassword}
                        onChange={e => setMemPassword(e.target.value)}
                        placeholder="Min 6 characters" className="input-field pr-14" />
                      <button type="button" onClick={() => setShowMemPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">
                        {showMemPwd ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Role</label>
                    <select value={memRole} onChange={e => setMemRole(e.target.value)} className="input-field">
                      <option value="member">Member</option>
                      {isFirstAdmin && <option value="second_admin">Secondary Admin</option>}
                    </select>
                  </div>
                </div>
                {memMsg && <p className="mt-3 text-sm">{memMsg}</p>}
                <button onClick={createMember} disabled={memSaving} className="mt-4 btn-primary">
                  {memSaving ? 'Creating…' : 'Create member'}
                </button>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Reset member password</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Select member</label>
                    <select value={resetId} onChange={e => setResetId(e.target.value)} className="input-field">
                      <option value="">— Select —</option>
                      {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">New password</label>
                    <div className="relative">
                      <input type={showResetPwd ? 'text' : 'password'} value={resetPwd}
                        onChange={e => setResetPwd(e.target.value)}
                        placeholder="Min 6 characters" className="input-field pr-14" />
                      <button type="button" onClick={() => setShowResetPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">
                        {showResetPwd ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>
                {resetMsg && <p className="mt-3 text-sm">{resetMsg}</p>}
                <button onClick={resetPassword} disabled={resetSaving} className="mt-4 btn-primary">
                  {resetSaving ? 'Processing…' : 'Reset password'}
                </button>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Members <span className="text-gray-400 font-normal text-sm">({members.length})</span>
                </h2>
                {removeMsg && <p className="mb-3 text-sm">{removeMsg}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-2 text-xs font-medium text-gray-500">Name</th>
                        <th className="pb-2 text-xs font-medium text-gray-500">Email</th>
                        <th className="pb-2 text-xs font-medium text-gray-500">Role</th>
                        <th className="pb-2 text-xs font-medium text-gray-500">Joined</th>
                        {isFirstAdmin && <th className="pb-2 text-xs font-medium text-gray-500">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m: any) => (
                        <tr key={m.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                          <td className="py-2.5 text-gray-500 text-xs">{m.email}</td>
                          <td className="py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-600'}`}>
                              {ROLE_LABELS[m.role] || m.role}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-400 text-xs">
                            {new Date(m.created_at).toLocaleDateString('en-US')}
                          </td>
                          {isFirstAdmin && (
                            <td className="py-2.5">
                              {m.id !== profile?.id && m.role !== 'first_admin' && (
                                <button
                                  onClick={() => removeMember(m.id, m.name)}
                                  disabled={removeSaving === m.id}
                                  className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-red-200 hover:border-red-400 transition-colors disabled:opacity-50">
                                  {removeSaving === m.id ? 'Removing…' : 'Remove'}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
