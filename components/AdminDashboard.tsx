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

// Feature 13 — professional title labels & colours
const TITLE_OPTIONS = [
  { value: '',                label: '— No title —' },
  { value: 'senior_partner',  label: 'Senior Partner' },
  { value: 'partner',         label: 'Partner' },
  { value: 'of_counsel',      label: 'Of Counsel' },
  { value: 'senior_associate',label: 'Senior Associate' },
  { value: 'associate',       label: 'Associate' },
  { value: 'paralegal',       label: 'Paralegal' },
  { value: 'consultant',      label: 'Consultant' },
  { value: 'staff',           label: 'Staff' },
]

const TITLE_LABELS: Record<string, string> = Object.fromEntries(
  TITLE_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])
)

const TITLE_COLORS: Record<string, string> = {
  senior_partner:  'bg-indigo-200 text-indigo-800',
  partner:         'bg-indigo-100 text-indigo-700',
  of_counsel:      'bg-orange-100 text-orange-700',
  senior_associate:'bg-sky-200 text-sky-800',
  associate:       'bg-sky-100 text-sky-700',
  paralegal:       'bg-violet-100 text-violet-700',
  consultant:      'bg-amber-100 text-amber-700',
  staff:           'bg-gray-100 text-gray-600',
}

const INTAKE_STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  reviewed:  'Reviewed',
  converted: 'Converted',
  dismissed: 'Dismissed',
}

const INTAKE_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  reviewed:  'bg-blue-100 text-blue-700',
  converted: 'bg-teal-100 text-teal-700',
  dismissed: 'bg-gray-100 text-gray-500',
}

const MATTER_TYPE_LABELS_BRIEF: Record<string, string> = {
  criminal: 'Criminal', corporate: 'Corporate', family: 'Family',
  ip: 'IP', real_estate: 'Real Estate', labor: 'Labor',
  administrative: 'Admin', civil: 'Civil', other: 'Other',
}

export default function AdminDashboard({
  profile, projects, members, groupId, group, subdomain, clients: initialClients, intakes: initialIntakes,
}: {
  profile: any
  projects: any[]
  members: any[]
  groupId: string
  group: { id: string; name: string; description: string }
  subdomain: string
  clients: any[]
  intakes: any[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const isFirstAdmin = profile?.role === 'first_admin'
  const isAdmin = ['first_admin', 'second_admin'].includes(profile?.role)

  const [tab, setTab] = useState<'projects' | 'members' | 'clients' | 'intake'>('projects')

  // ── Intakes (Feature 19) ──────────────────────────────────
  const [intakes,       setIntakes]       = useState<any[]>(initialIntakes)
  const [intakeSaving,  setIntakeSaving]  = useState<string | null>(null)

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
      const existing = await getGroupKey(adminId, groupId, keyPair).catch(() => null)
      if (!existing) {
        const memberIds = members.filter((m: any) => m.id !== adminId).map((m: any) => m.id)
        await createAndDistributeGroupKey(adminId, groupId, keyPair, memberIds)
      }
      setGroupKeyReady(true)

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
  const [projClientId,   setProjClientId]   = useState('')   // CRM link
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
  const [memTitle,    setMemTitle]    = useState('')
  const [memSaving,   setMemSaving]   = useState(false)
  const [memMsg,      setMemMsg]      = useState('')

  // ── Add existing user ─────────────────────────────────────
  const [addEmail,   setAddEmail]   = useState('')
  const [addRole,    setAddRole]    = useState('member')
  const [addTitle,   setAddTitle]   = useState('')
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

  // ── Edit member title (Feature 13) ───────────────────────
  const [editingTitleId,  setEditingTitleId]  = useState<string | null>(null)
  const [editingTitle,    setEditingTitle]    = useState('')
  const [titleSaving,     setTitleSaving]     = useState(false)

  // ── Clients CRM (Feature 14) ─────────────────────────────
  const [clients,         setClients]         = useState<any[]>(initialClients)
  const [cliName,         setCliName]         = useState('')
  const [cliContactName,  setCliContactName]  = useState('')
  const [cliContactEmail, setCliContactEmail] = useState('')
  const [cliContactPhone, setCliContactPhone] = useState('')
  const [cliNotes,        setCliNotes]        = useState('')
  const [cliSaving,       setCliSaving]       = useState(false)
  const [cliMsg,          setCliMsg]          = useState('')
  const [cliDeleting,     setCliDeleting]     = useState<string | null>(null)
  const [editingClient,   setEditingClient]   = useState<any | null>(null)

  function addCollabParty() { setCollabParties([...collabParties, '']) }
  function updateCollabParty(i: number, v: string) {
    const u = [...collabParties]; u[i] = v; setCollabParties(u)
  }
  function removeCollabParty(i: number) {
    if (collabParties.length === 1) return
    setCollabParties(collabParties.filter((_, j) => j !== i))
  }

  // When a CRM client is selected, auto-fill the free-text client field
  function handleCrmClientSelect(clientId: string) {
    setProjClientId(clientId)
    if (clientId) {
      const c = clients.find(c => c.id === clientId)
      if (c) setProjClient(c.name)
    } else {
      setProjClient('')
    }
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
      client_id:             projClientId || null,
      group_id:              groupId,
      created_by:            profile.id,
    })
    if (error) {
      setProjMsg(`❌ Creation failed: ${error.message}`)
    } else {
      setProjMsg('✅ Matter created')
      setProjName(''); setProjClient(''); setProjClientId(''); setProjDesc('')
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
      body: JSON.stringify({ callerUserId: profile.id, email: addEmail.trim(), role: addRole, title: addTitle || null, groupId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setAddMsg(`❌ ${json.error || 'Operation failed'}`)
    } else {
      if (keyPair && isFirstAdmin && json.userId) {
        addMemberToGroup(profile.id as string, groupId, keyPair, json.userId).catch(() => {})
      }
      setAddMsg(`✅ Added "${json.name}" to the team`)
      setAddEmail(''); setAddTitle('')
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
      body: JSON.stringify({ callerUserId: profile.id, name: memName.trim(), email: memEmail.trim(), password: memPassword, role: memRole, title: memTitle || null, groupId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMemMsg(`❌ ${json.error || 'Creation failed'}`)
    } else {
      if (keyPair && isFirstAdmin && json.newUserId) {
        addMemberToGroup(profile.id as string, groupId, keyPair, json.newUserId).catch(() => {})
      }
      setMemMsg('✅ Member created')
      setMemName(''); setMemEmail(''); setMemPassword(''); setMemRole('member'); setMemTitle('')
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

  async function updateIntakeStatus(id: string, status: string) {
    setIntakeSaving(id)
    const { error } = await supabase.from('intake_submissions').update({ status }).eq('id', id)
    if (!error) setIntakes(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    setIntakeSaving(null)
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
      if (isFirstAdmin) {
        removeMemberFromGroup(groupId, memberId).catch(() => {})
      }
      setTimeout(() => router.refresh(), 400)
    }
    setRemoveSaving(null)
  }

  // Feature 13 — update member professional title
  async function saveTitle(memberId: string) {
    setTitleSaving(true)
    const { error } = await supabase
      .from('group_members')
      .update({ title: editingTitle || null })
      .eq('group_id', groupId)
      .eq('user_id', memberId)
    setTitleSaving(false)
    if (!error) {
      setEditingTitleId(null)
      router.refresh()
    }
  }

  // Feature 14 — client CRUD
  async function createClientRecord() {
    if (!cliName.trim()) { setCliMsg('❌ Client name is required'); return }
    setCliSaving(true); setCliMsg('')
    const { data, error } = await supabase.from('clients').insert({
      group_id:      groupId,
      name:          cliName.trim(),
      contact_name:  cliContactName.trim() || null,
      contact_email: cliContactEmail.trim() || null,
      contact_phone: cliContactPhone.trim() || null,
      notes:         cliNotes.trim() || null,
      created_by:    profile.id,
    }).select('id, name, contact_name, contact_email, contact_phone, notes, created_at').single()
    if (error) {
      setCliMsg(`❌ ${error.message}`)
    } else {
      setClients(prev => [data, ...prev])
      setCliMsg('✅ Client added')
      setCliName(''); setCliContactName(''); setCliContactEmail(''); setCliContactPhone(''); setCliNotes('')
    }
    setCliSaving(false)
  }

  async function saveClientEdit() {
    if (!editingClient || !editingClient.name.trim()) return
    setCliSaving(true)
    const { error } = await supabase.from('clients').update({
      name:          editingClient.name.trim(),
      contact_name:  editingClient.contact_name?.trim() || null,
      contact_email: editingClient.contact_email?.trim() || null,
      contact_phone: editingClient.contact_phone?.trim() || null,
      notes:         editingClient.notes?.trim() || null,
    }).eq('id', editingClient.id)
    setCliSaving(false)
    if (!error) {
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...editingClient } : c))
      setEditingClient(null)
    }
  }

  async function deleteClient(id: string, name: string) {
    if (!confirm(`Delete client "${name}"? Matters linked to this client will be unlinked but not deleted.`)) return
    setCliDeleting(id)
    const { error } = await supabase.from('clients').delete().eq('id', id)
    setCliDeleting(null)
    if (!error) {
      setClients(prev => prev.filter(c => c.id !== id))
    }
  }

  // Count matters per client from local displayProjects state
  const matterCountByClient: Record<string, number> = {}
  for (const p of displayProjects) {
    if (p.client_id) matterCountByClient[p.client_id] = (matterCountByClient[p.client_id] || 0) + 1
  }

  return (
    <Sidebar profile={profile} groupId={groupId} groupName={group.name} subdomain={subdomain}>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="flex items-center px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Admin</h1>
          <span className="ml-3 text-sm text-gray-400">· {group.name}</span>
          <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[profile?.role] || ''}`}>
            {ROLE_LABELS[profile?.role] || profile?.role}
          </span>
        </div>

        <div className="flex border-b border-gray-200 bg-white px-6 flex-shrink-0">
          {(['projects', 'members', 'clients', 'intake'] as const).map(key => {
            const label = key === 'projects' ? 'Matters' : key === 'members' ? 'Members'
              : key === 'clients' ? 'Clients' : `Intake${intakes.filter(i => i.status === 'pending').length > 0 ? ` (${intakes.filter(i => i.status === 'pending').length})` : ''}`
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${tab === key ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            )
          })}
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

                  {/* Client — CRM dropdown + free-text */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm text-gray-700 mb-1">Client *</label>
                    {clients.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={projClientId}
                          onChange={e => handleCrmClientSelect(e.target.value)}
                          className="input-field"
                        >
                          <option value="">— Select CRM client or type below —</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <input value={projClient} onChange={e => { setProjClient(e.target.value); if (!e.target.value) setProjClientId('') }}
                          placeholder="Or type client name" className="input-field" />
                      </div>
                    ) : (
                      <input value={projClient} onChange={e => setProjClient(e.target.value)}
                        placeholder="Client name" className="input-field" />
                    )}
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
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>Client: {p.client}</span>
                          {p.client_id && (
                            <span className="text-xs px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded border border-teal-200">CRM</span>
                          )}
                        </div>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                      placeholder="Their registered email" className="input-field" />
                  </div>
                  {isFirstAdmin && (
                    <div>
                      <select value={addRole} onChange={e => setAddRole(e.target.value)} className="input-field">
                        <option value="member">Member</option>
                        <option value="second_admin">Secondary Admin</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <select value={addTitle} onChange={e => setAddTitle(e.target.value)} className="input-field">
                      {TITLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addExistingMember} disabled={addSaving} className="mt-3 btn-primary">
                  {addSaving ? 'Adding…' : 'Add member'}
                </button>
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
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm text-gray-700 mb-1">Professional title</label>
                    <select value={memTitle} onChange={e => setMemTitle(e.target.value)} className="input-field">
                      {TITLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                        <th className="pb-2 text-xs font-medium text-gray-500">Title</th>
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
                          {/* Feature 13 — title cell with inline edit */}
                          <td className="py-2.5">
                            {editingTitleId === m.id ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={editingTitle}
                                  onChange={e => setEditingTitle(e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-1 py-0.5"
                                  autoFocus
                                >
                                  {TITLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <button
                                  onClick={() => saveTitle(m.id)}
                                  disabled={titleSaving}
                                  className="text-xs text-teal-600 hover:text-teal-800 font-medium px-1"
                                >
                                  {titleSaving ? '…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingTitleId(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                >✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {m.title ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${TITLE_COLORS[m.title] || 'bg-gray-100 text-gray-600'}`}>
                                    {TITLE_LABELS[m.title] || m.title}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => { setEditingTitleId(m.id); setEditingTitle(m.title || '') }}
                                    className="text-xs text-gray-300 hover:text-teal-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Edit title"
                                  >✎</button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 text-gray-400 text-xs">
                            {new Date(m.created_at).toLocaleDateString('en-US')}
                          </td>
                          {isFirstAdmin && (
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                {editingTitleId !== m.id && (
                                  <button
                                    onClick={() => { setEditingTitleId(m.id); setEditingTitle(m.title || '') }}
                                    className="text-xs text-gray-400 hover:text-teal-600 px-1.5 py-0.5 rounded border border-gray-200 hover:border-teal-300 transition-colors"
                                  >
                                    Edit title
                                  </button>
                                )}
                                {m.id !== profile?.id && m.role !== 'first_admin' && (
                                  <button
                                    onClick={() => removeMember(m.id, m.name)}
                                    disabled={removeSaving === m.id}
                                    className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-red-200 hover:border-red-400 transition-colors disabled:opacity-50">
                                    {removeSaving === m.id ? 'Removing…' : 'Remove'}
                                  </button>
                                )}
                              </div>
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

          {/* ──────── Intake (Feature 19) ──────── */}
          {tab === 'intake' && (
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Client Intake Submissions</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Intake URL: <span className="font-mono text-teal-700">teaming365.com/intake/{subdomain}</span>
                  </p>
                </div>
                <span className="text-xs text-gray-400">{intakes.length} total</span>
              </div>

              {intakes.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <p className="text-sm text-gray-400">No intake submissions yet.</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Share <span className="font-mono text-teal-600">teaming365.com/intake/{subdomain}</span> with prospective clients.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {intakes.map(i => (
                    <div key={i.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{i.name}</span>
                            {i.matter_type && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {MATTER_TYPE_LABELS_BRIEF[i.matter_type] || i.matter_type}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INTAKE_STATUS_COLORS[i.status] || 'bg-gray-100 text-gray-500'}`}>
                              {INTAKE_STATUS_LABELS[i.status] || i.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {i.email && <span className="text-xs text-gray-500">✉️ {i.email}</span>}
                            {i.phone && <span className="text-xs text-gray-500">📞 {i.phone}</span>}
                            <span className="text-xs text-gray-400">
                              {new Date(i.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          {i.description && (
                            <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3">{i.description}</p>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex-shrink-0">
                            <select
                              value={i.status}
                              onChange={e => updateIntakeStatus(i.id, e.target.value)}
                              disabled={intakeSaving === i.id}
                              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500">
                              <option value="pending">Pending</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="converted">Converted</option>
                              <option value="dismissed">Dismissed</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──────── Clients (Feature 14) ──────── */}
          {tab === 'clients' && (
            <div className="max-w-3xl space-y-6">

              {/* Create client */}
              {isAdmin && (
                <section className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Add client</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Client / organisation name *</label>
                      <input value={cliName} onChange={e => setCliName(e.target.value)}
                        placeholder="e.g. Acme Corp" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Contact person</label>
                      <input value={cliContactName} onChange={e => setCliContactName(e.target.value)}
                        placeholder="Full name" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Contact email</label>
                      <input type="email" value={cliContactEmail} onChange={e => setCliContactEmail(e.target.value)}
                        placeholder="email@example.com" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Contact phone</label>
                      <input type="tel" value={cliContactPhone} onChange={e => setCliContactPhone(e.target.value)}
                        placeholder="+1 555 0100" className="input-field" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Notes</label>
                      <textarea value={cliNotes} onChange={e => setCliNotes(e.target.value)}
                        placeholder="Background notes, preferences, etc." rows={2} className="input-field resize-none" />
                    </div>
                  </div>
                  {cliMsg && <p className="mt-3 text-sm">{cliMsg}</p>}
                  <button onClick={createClientRecord} disabled={cliSaving} className="mt-4 btn-primary">
                    {cliSaving ? 'Saving…' : 'Add client'}
                  </button>
                </section>
              )}

              {/* Edit client modal (inline overlay) */}
              {editingClient && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                    <h3 className="text-base font-semibold text-gray-900">Edit client</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Name *</label>
                        <input value={editingClient.name} onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                          className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Contact person</label>
                        <input value={editingClient.contact_name || ''} onChange={e => setEditingClient({ ...editingClient, contact_name: e.target.value })}
                          className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Contact email</label>
                        <input type="email" value={editingClient.contact_email || ''} onChange={e => setEditingClient({ ...editingClient, contact_email: e.target.value })}
                          className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Contact phone</label>
                        <input type="tel" value={editingClient.contact_phone || ''} onChange={e => setEditingClient({ ...editingClient, contact_phone: e.target.value })}
                          className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Notes</label>
                        <textarea value={editingClient.notes || ''} onChange={e => setEditingClient({ ...editingClient, notes: e.target.value })}
                          rows={3} className="input-field resize-none" />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={saveClientEdit} disabled={cliSaving} className="btn-primary flex-1">
                        {cliSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingClient(null)}
                        className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Client list */}
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Clients <span className="text-gray-400 font-normal text-sm">({clients.length})</span>
                </h2>

                {clients.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">No clients yet. Add your first client above.</p>
                ) : (
                  <div className="space-y-3">
                    {clients.map((c: any) => {
                      const matterCount = matterCountByClient[c.id] || 0
                      return (
                        <div key={c.id} className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                                {matterCount > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-teal-50 text-teal-600 rounded-full border border-teal-200">
                                    {matterCount} matter{matterCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 space-y-0.5">
                                {c.contact_name && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    {c.contact_name}
                                  </div>
                                )}
                                {c.contact_email && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {c.contact_email}
                                  </div>
                                )}
                                {c.contact_phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    {c.contact_phone}
                                  </div>
                                )}
                                {c.notes && (
                                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.notes}</p>
                                )}
                              </div>
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => setEditingClient({ ...c })}
                                  className="text-xs text-gray-400 hover:text-teal-600 px-2 py-1 rounded border border-gray-200 hover:border-teal-300 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteClient(c.id, c.name)}
                                  disabled={cliDeleting === c.id}
                                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-100 hover:border-red-300 transition-colors disabled:opacity-50"
                                >
                                  {cliDeleting === c.id ? '…' : 'Delete'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Matter history for this client */}
                          {matterCount > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-1.5">Linked matters</p>
                              <div className="space-y-1">
                                {displayProjects.filter(p => p.client_id === c.id).map(p => (
                                  <div key={p.id} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-700 font-medium truncate max-w-[240px]">{p.name}</span>
                                    <span className={`ml-2 flex-shrink-0 px-1.5 py-0.5 rounded text-xs status-tag st-${p.status}`}>
                                      {STATUS_LABELS[p.status] || p.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

        </div>
      </div>
    </Sidebar>
  )
}
