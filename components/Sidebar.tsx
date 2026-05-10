'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClerk } from '@clerk/nextjs'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { encField, decField } from '@/lib/e2e'

const TYPE_LABELS: Record<string, string> = {
  court_hearing:          'Court Hearing',
  filing_deadline:        'Filing Deadline',
  consultation:           'Legal Consultation',
  statute_of_limitations: 'Limitation Period',
  online_meeting:         'Online Meeting',
  visiting:               'Client Visit',
  business_travel:        'Business Trip',
  personal_leave:         'Day Off',
  visiting_reception:     'Meet Client',
  others:                 'Other',
}

const TYPE_COLORS: Record<string, string> = {
  court_hearing:          'bg-red-100 text-red-700',
  filing_deadline:        'bg-rose-100 text-rose-700',
  consultation:           'bg-teal-100 text-teal-700',
  statute_of_limitations: 'bg-pink-100 text-pink-800',
  online_meeting:         'bg-blue-100 text-blue-700',
  visiting:               'bg-purple-100 text-purple-700',
  business_travel:        'bg-orange-100 text-orange-700',
  personal_leave:         'bg-yellow-100 text-yellow-700',
  visiting_reception:     'bg-green-100 text-green-700',
  others:                 'bg-gray-100 text-gray-600',
}

const ROW_BG    = ['bg-white', 'bg-gray-50']
const MAX_UPCOMING = 10

type Member = { id: string; name: string }

type Reminder = {
  id: string
  due_date: string
  start_date: string | null
  end_date: string | null
  content: string
  type: string
  start_time: string | null
  end_time: string | null
  created_by: string
  created_at: string
  deleted: boolean
  deleted_by: string | null
  deleted_by_name: string | null
  deleted_at: string | null
  assigned_to_name: string | null
  pre_alert_days: number[]
}

type GroupInfo = { id: string; name: string }

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
  groupId: string
  groupName: string
  subdomain: string
}

// ── Pure helpers ──────────────────────────────────────────────
function fmtTime(t: string | null) { return t ? t.slice(0, 5) : '' }
function remPrimaryDate(r: Reminder) { return r.start_date || r.due_date }
function remEndDate(r: Reminder)     { return r.end_date || r.start_date || r.due_date }

function remDateLabel(r: Reminder) {
  const sd = remPrimaryDate(r), ed = remEndDate(r)
  const sl = sd.slice(5, 7) + '/' + sd.slice(8, 10)
  return sd === ed ? sl : sl + '–' + ed.slice(5, 7) + '/' + ed.slice(8, 10)
}

function remFullDateLabel(r: Reminder, today: string) {
  const sd = remPrimaryDate(r), ed = remEndDate(r)
  const fmt = (s: string) => `${s.slice(0,4)}/${s.slice(5,7)}/${s.slice(8,10)}`
  return sd === ed ? (sd === today ? 'Today · ' : '') + fmt(sd) : fmt(sd) + ' – ' + fmt(ed)
}

export default function Sidebar({ profile, groupId, groupName, subdomain }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { signOut } = useClerk()

  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  const isAdmin  = ['first_admin', 'second_admin'].includes(profile?.role || '')
  const todayStr = new Date().toISOString().split('T')[0]

  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null)
  const [reminders,        setReminders]        = useState<Reminder[]>([])
  const [displayReminders, setDisplayReminders] = useState<Reminder[]>([])
  const [members,          setMembers]          = useState<Member[]>([])
  const [myGroups,         setMyGroups]         = useState<GroupInfo[]>([])
  const [showGroupPicker,  setShowGroupPicker]  = useState(false)
  const [showAllUpcoming,  setShowAllUpcoming]  = useState(false)
  const [showAllRem,       setShowAllRem]       = useState(false)
  const [showCourtDates,   setShowCourtDates]   = useState(true)

  // ── Add reminder form ─────────────────────────────────────
  const [showAddRem,   setShowAddRem]   = useState(false)
  const [remType,      setRemType]      = useState('others')
  const [remStartDate, setRemStartDate] = useState(todayStr)
  const [remEndDate_,  setRemEndDate_]  = useState(todayStr)
  const [remStartTime, setRemStartTime] = useState('')
  const [remEndTime,   setRemEndTime]   = useState('')
  const [remContent,   setRemContent]   = useState('')
  const [remAssigned,  setRemAssigned]  = useState('')
  const [remPreAlerts, setRemPreAlerts] = useState<number[]>([])
  const [remSaving,    setRemSaving]    = useState(false)

  // ── Detail / edit modal ───────────────────────────────────
  const [selectedRem,    setSelectedRem]   = useState<Reminder | null>(null)
  const [detailMode,     setDetailMode]    = useState<'view' | 'edit'>('view')
  const [editType,       setEditType]      = useState('others')
  const [editStartDate,  setEditStartDate] = useState(todayStr)
  const [editEndDate_,   setEditEndDate_]  = useState(todayStr)
  const [editStartTime,  setEditStartTime] = useState('')
  const [editEndTime,    setEditEndTime]   = useState('')
  const [editContent,    setEditContent]   = useState('')
  const [editAssigned,   setEditAssigned]  = useState('')
  const [editPreAlerts,  setEditPreAlerts] = useState<number[]>([])
  const [editSaving,     setEditSaving]    = useState(false)

  useEffect(() => {
    const uid = profile?.id || null
    setCurrentUserId(uid)
    if (uid) loadMyGroups(uid)
    loadReminders()
    loadMembers()
  }, [groupId])

  useEffect(() => {
    setDisplayReminders(reminders.map(r => ({ ...r, content: decField(r.content, groupKey) || r.content })))
  }, [reminders, groupKey])

  async function loadReminders() {
    const { data, error } = await supabase
      .from('reminders').select('*')
      .eq('group_id', groupId).order('due_date', { ascending: true })
    if (!error) setReminders(data || [])
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('group_members').select('profiles(id, name)').eq('group_id', groupId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMembers((data || []).map((m: any) => ({ id: m.profiles?.id || '', name: m.profiles?.name || '' })).filter(m => m.id))
  }

  async function loadMyGroups(userId: string) {
    const { data } = await supabase
      .from('group_members').select('groups(id, name)').eq('user_id', userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMyGroups((data || []).map((m: any) => ({ id: m.groups?.id || '', name: m.groups?.name || '' })).filter(g => g.id))
  }

  async function switchGroup(gid: string) {
    document.cookie = `qt_group=${gid}; path=/; max-age=86400; SameSite=Lax`
    setShowGroupPicker(false)
    const { data: grp } = await supabase.from('groups').select('subdomain').eq('id', gid).single()
    if (grp?.subdomain) {
      router.push(`/${grp.subdomain}/projects`)
    } else {
      router.push('/projects')
    }
    router.refresh()
  }

  // ── Reminder partitions ───────────────────────────────────
  const upcoming = displayReminders
    .filter(r => !r.deleted && remEndDate(r) >= todayStr)
    .sort((a, b) => remPrimaryDate(a).localeCompare(remPrimaryDate(b)))
  const past = displayReminders
    .filter(r => !r.deleted && remEndDate(r) < todayStr)
    .sort((a, b) => remPrimaryDate(b).localeCompare(remPrimaryDate(a)))
  const deletedRems = displayReminders
    .filter(r => r.deleted)
    .sort((a, b) => (b.deleted_at ?? remPrimaryDate(b)).localeCompare(a.deleted_at ?? remPrimaryDate(a)))

  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, MAX_UPCOMING)
  const hasMoreUpcoming = !showAllUpcoming && upcoming.length > MAX_UPCOMING

  // ── Save new reminder ────────────────────────────────────
  async function saveReminder() {
    if (!remStartDate || !remEndDate_ || !remContent.trim()) { alert('Please fill in all required fields'); return }
    if (remEndDate_ < remStartDate) { alert('End date cannot be before start date'); return }
    if (remEndTime && remStartTime && remEndTime <= remStartTime) { alert('End time must be after start time'); return }
    setRemSaving(true)
    const { error } = await supabase.from('reminders').insert({
      due_date: remStartDate, start_date: remStartDate, end_date: remEndDate_,
      content: encField(remContent.trim(), groupKey) ?? remContent.trim(), type: remType,
      start_time: remStartTime || null, end_time: remEndTime || null,
      assigned_to_name: remAssigned || null,
      pre_alert_days: remPreAlerts,
      group_id: groupId, created_by: profile!.id,
    })
    if (error) { alert('Save failed: ' + error.message) }
    else { setShowAddRem(false); resetAddForm(); await loadReminders() }
    setRemSaving(false)
  }

  function resetAddForm() {
    setRemContent(''); setRemStartDate(todayStr); setRemEndDate_(todayStr)
    setRemType('others'); setRemStartTime(''); setRemEndTime('')
    setRemAssigned(''); setRemPreAlerts([])
  }

  function openDetailRem(r: Reminder) { setSelectedRem(r); setDetailMode('view') }
  function closeDetailRem()           { setSelectedRem(null); setDetailMode('view') }

  function startEditRem(r: Reminder) {
    setEditType(r.type || 'others')
    setEditStartDate(r.start_date || r.due_date)
    setEditEndDate_(r.end_date || r.start_date || r.due_date)
    setEditStartTime(r.start_time || '')
    setEditEndTime(r.end_time || '')
    setEditContent(r.content)
    setEditAssigned(r.assigned_to_name || '')
    setEditPreAlerts(r.pre_alert_days || [])
    setDetailMode('edit')
  }

  async function saveEditRem() {
    if (!editStartDate || !editEndDate_ || !editContent.trim()) { alert('Please fill in all required fields'); return }
    if (editEndDate_ < editStartDate) { alert('End date cannot be before start date'); return }
    if (editEndTime && editStartTime && editEndTime <= editStartTime) { alert('End time must be after start time'); return }
    setEditSaving(true)
    const { error } = await supabase.from('reminders').update({
      due_date: editStartDate, start_date: editStartDate, end_date: editEndDate_,
      content: encField(editContent.trim(), groupKey) ?? editContent.trim(), type: editType,
      start_time: editStartTime || null, end_time: editEndTime || null,
      assigned_to_name: editAssigned || null, pre_alert_days: editPreAlerts,
    }).eq('id', selectedRem!.id).eq('group_id', groupId)
    setEditSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function softDeleteReminder(id: string) {
    if (!confirm('Delete this event? It will still be visible in history.')) return
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', profile!.id).single()
    const { error } = await supabase.from('reminders').update({
      deleted: true, deleted_by: profile!.id,
      deleted_by_name: prof?.name || 'Unknown', deleted_at: new Date().toISOString(),
    }).eq('id', id).eq('group_id', groupId)
    if (error) { alert('Delete failed: ' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function restoreReminder(id: string) {
    const { error } = await supabase.from('reminders').update({
      deleted: false, deleted_by: null, deleted_by_name: null, deleted_at: null,
    }).eq('id', id).eq('group_id', groupId)
    if (error) { alert('Restore failed: ' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function hardDeleteReminder(id: string) {
    if (!confirm('Permanently delete? This cannot be undone.')) return
    const { error } = await supabase.from('reminders').delete().eq('id', id).eq('group_id', groupId)
    if (error) { alert('Delete failed: ' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function handleLogout() {
    document.cookie = 'qt_group=; path=/; max-age=0'
    await signOut()
    router.push('/login')
    router.refresh()
  }

  // ── Inner helpers (defined inside component — no inputs, safe) ──
  function TypeGrid({ current, onSet }: { current: string; onSet: (v: string) => void }) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(TYPE_LABELS).map(([val, label]) => (
          <button key={val} type="button" onClick={() => onSet(val)}
            className={`py-1.5 px-3 text-sm rounded-lg border transition-colors text-left
              ${current === val ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
    )
  }

  function MemberSelector({ current, onSet }: { current: string; onSet: (v: string) => void }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onSet('')}
          className={`text-xs px-2 py-1 rounded border transition-colors
            ${current === '' ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          Unassigned
        </button>
        {members.map(m => (
          <button key={m.id} type="button" onClick={() => onSet(m.name)}
            className={`text-xs px-2 py-1 rounded border transition-colors
              ${current === m.name ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {m.name}
          </button>
        ))}
      </div>
    )
  }

  function DateTimeFields({
    startDate, endDate, startTime, endTime,
    onStartDate, onEndDate, onStartTime, onEndTime,
  }: {
    startDate: string; endDate: string; startTime: string; endTime: string
    onStartDate: (v: string) => void; onEndDate: (v: string) => void
    onStartTime: (v: string) => void; onEndTime:  (v: string) => void
  }) {
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start date <span className="text-red-500">*</span></label>
            <input type="date" value={startDate}
              onChange={e => { onStartDate(e.target.value); if (endDate < e.target.value) onEndDate(e.target.value) }}
              className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End date <span className="text-red-500">*</span></label>
            <input type="date" value={endDate} min={startDate} onChange={e => onEndDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
            <input type="time" value={startTime} onChange={e => onStartTime(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
            <input type="time" value={endTime} onChange={e => onEndTime(e.target.value)} className="input-field" />
          </div>
        </div>
      </>
    )
  }

  function ReminderRow({ r, index, variant }: { r: Reminder; index: number; variant: 'upcoming' | 'past' | 'deleted' }) {
    const primDate  = remPrimaryDate(r)
    const isToday   = primDate === todayStr
    const dateLabel = remDateLabel(r)
    const rowBg     = variant === 'upcoming' ? (isToday ? '' : ROW_BG[index % 2]) : ''
    const cls =
      variant === 'upcoming' && isToday ? 'bg-amber-50 border-amber-400 hover:bg-amber-100'
      : variant === 'upcoming'          ? `${rowBg} border-gray-400 hover:border-teal-500 hover:bg-teal-50/40`
      : variant === 'past'              ? 'bg-gray-50 border-gray-300 opacity-60 hover:opacity-80'
      : 'bg-red-50/40 border-red-300 opacity-50 hover:opacity-70'
    return (
      <button onClick={() => openDetailRem(r)}
        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border transition-all ${cls}`}>
        <div className="flex flex-col items-start flex-shrink-0 min-w-9 mt-0.5">
          <span className={`text-xs font-bold leading-tight
            ${variant === 'upcoming' && isToday ? 'text-amber-600' : variant === 'upcoming' ? 'text-teal-600' : 'text-gray-400'}`}>
            {dateLabel}
          </span>
          {variant === 'upcoming' && r.start_time && (
            <span className="text-[10px] text-gray-400 leading-tight mt-0.5">
              {fmtTime(r.start_time)}{r.end_time ? `–${fmtTime(r.end_time)}` : ''}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className={`text-sm leading-snug
            ${variant === 'deleted' ? 'line-through text-gray-400'
            : variant === 'past'    ? 'line-through text-gray-500'
            : isToday               ? 'text-amber-800 font-medium'
            : 'text-gray-800'}`}>
            {r.content}
          </span>
          {variant === 'upcoming' && r.type && r.type !== 'others' && (
            <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded align-middle ${TYPE_COLORS[r.type] || TYPE_COLORS.others}`}>
              {TYPE_LABELS[r.type] || r.type}
            </span>
          )}
          {variant === 'upcoming' && r.assigned_to_name && (
            <span className="ml-1.5 text-[10px] text-indigo-500 font-medium align-middle">@{r.assigned_to_name}</span>
          )}
          {variant === 'past'    && <span className="ml-1.5 text-[10px] text-gray-400 align-middle">Past</span>}
          {variant === 'deleted' && r.deleted_by_name && (
            <span className="ml-1.5 text-[10px] text-red-400 align-middle">Deleted · {r.deleted_by_name}</span>
          )}
        </div>
      </button>
    )
  }

  // ── Nav links (no Matters — logo click navigates to projects) ──
  const navLinks = [
    { href: `/${subdomain}/my-stats`,     label: 'My Stats',   icon: '📊' },
    ...(isAdmin ? [
      { href: `/${subdomain}/team-stats`, label: 'Team Stats', icon: '👥' },
    ] : []),
  ]

  return (
    <>
      <div className="w-[384px] bg-white border-r border-gray-200 text-gray-900 flex flex-col h-full flex-shrink-0">

        {/* ── Logo — click goes to main (projects) page ──────── */}
        <button onClick={() => router.push(`/${subdomain}/projects`)}
          className="px-4 py-3 border-b border-teal-200 flex-shrink-0 w-full text-left bg-teal-100 hover:bg-teal-200 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-teal-600 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {subdomain.charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-xs font-semibold text-gray-900 truncate capitalize">{subdomain}</div>
              <div className="text-[11px] text-gray-500 truncate">{profile?.name || ''}</div>
            </div>
          </div>
        </button>

        {/* ── Navigation ───────────────────────────────────── */}
        <nav className="px-3 py-3 space-y-1 border-b border-gray-200 flex-shrink-0">
          {navLinks.map(link => {
            const isActive = pathname === link.href
            return (
              <button key={link.href} onClick={() => router.push(link.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left
                  ${isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <span className="text-base leading-none">{link.icon}</span>
                <span>{link.label}</span>
              </button>
            )
          })}
        </nav>

        {/* ── Schedule ─────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 bg-violet-100 border-b border-violet-200">
            <span className="text-sm font-semibold text-gray-700">📅 Schedule</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowAllRem(true)}
                className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300 hover:border-teal-400 transition-colors">
                All
              </button>
              <button onClick={() => setShowAddRem(true)}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium px-2 py-0.5 rounded transition-colors">
                + Add
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">

            {/* Pre-alerts firing today */}
            {(() => {
              const preAlerts = upcoming.filter(r => {
                if (!r.pre_alert_days || r.pre_alert_days.length === 0) return false
                const d = Math.ceil((new Date(remPrimaryDate(r)).getTime() - new Date(todayStr).getTime()) / 86400000)
                return r.pre_alert_days.includes(d)
              })
              if (preAlerts.length === 0) return null
              return (
                <div className="mb-2 pt-1">
                  <div className="flex items-center gap-1 px-1 pb-1">
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">⚡ Pre-alerts</span>
                  </div>
                  <div className="space-y-1">
                    {preAlerts.map(r => {
                      const d = Math.ceil((new Date(remPrimaryDate(r)).getTime() - new Date(todayStr).getTime()) / 86400000)
                      return (
                        <button key={r.id} onClick={() => openDetailRem(r)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors">
                          <span className="text-[10px] font-bold text-orange-700 min-w-8">⚡ {d}d</span>
                          <span className="text-xs text-orange-800 truncate">{r.content}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="h-px bg-gray-200 mt-2" />
                </div>
              )
            })()}

            {/* Court dates (next 14 days) */}
            {(() => {
              const courtTypes = ['court_hearing', 'filing_deadline']
              const cutoff = new Date(todayStr)
              cutoff.setDate(cutoff.getDate() + 14)
              const cutoffStr = cutoff.toISOString().slice(0, 10)
              const courtDates = upcoming.filter(r =>
                courtTypes.includes(r.type) && remPrimaryDate(r) <= cutoffStr
              )
              if (courtDates.length === 0) return null
              return (
                <div className="mb-2">
                  <button
                    onClick={() => setShowCourtDates(v => !v)}
                    className="flex items-center gap-1 px-1 pb-1 w-full">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">⚖️ Court Dates</span>
                    <span className="text-[10px] text-rose-400 ml-1">({courtDates.length})</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{showCourtDates ? '▲' : '▼'}</span>
                  </button>
                  {showCourtDates && (
                    <div className="space-y-1">
                      {courtDates.map(r => {
                        const primDate = remPrimaryDate(r)
                        const d = Math.ceil((new Date(primDate).getTime() - new Date(todayStr).getTime()) / 86400000)
                        const isUrgent = d <= 3
                        return (
                          <button key={r.id} onClick={() => openDetailRem(r)}
                            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors
                              ${isUrgent ? 'border-rose-300 bg-rose-50 hover:bg-rose-100' : 'border-red-100 bg-red-50/50 hover:bg-red-50'}`}>
                            <span className={`text-[10px] font-bold min-w-8 ${isUrgent ? 'text-rose-700' : 'text-red-500'}`}>
                              {primDate.slice(5, 7)}/{primDate.slice(8, 10)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className={`text-xs truncate block ${isUrgent ? 'text-rose-800 font-medium' : 'text-red-700'}`}>
                                {r.content}
                              </span>
                              <span className={`text-[10px] ${TYPE_COLORS[r.type] || ''} px-1 rounded`}>
                                {TYPE_LABELS[r.type]}
                              </span>
                            </div>
                            <span className={`text-[10px] font-semibold flex-shrink-0 ${isUrgent ? 'text-rose-700' : 'text-red-400'}`}>
                              {d === 0 ? 'Today' : `${d}d`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="h-px bg-gray-200 mt-2" />
                </div>
              )
            })()}

            {/* Regular upcoming reminders */}
            {visibleUpcoming.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="upcoming" />)}
            {hasMoreUpcoming && (
              <button onClick={() => setShowAllUpcoming(true)}
                className="w-full py-1.5 text-xs text-gray-500 hover:text-teal-600 border border-dashed border-gray-300 hover:border-teal-400 rounded-lg transition-colors">
                Show more ({upcoming.length - MAX_UPCOMING} more)
              </button>
            )}
            {showAllUpcoming && upcoming.length > MAX_UPCOMING && (
              <button onClick={() => setShowAllUpcoming(false)}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg transition-colors">
                Collapse
              </button>
            )}

            {past.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Past {past.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {past.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="past" />)}
              </>
            )}

            {deletedRems.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Deleted {deletedRems.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {deletedRems.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="deleted" />)}
              </>
            )}

            {displayReminders.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No events</p>}
          </div>
        </div>

        {/* ── User footer ──────────────────────────────────── */}
        <div className="px-3 py-3 border-t border-slate-300 flex-shrink-0 bg-slate-200">
          <div className="flex items-center gap-2 px-2 py-1.5">
            {myGroups.length > 1 && (
              <button onClick={() => setShowGroupPicker(true)}
                className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded border border-gray-400 text-gray-600 hover:bg-gray-300 transition-colors">
                🔀
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">{profile?.name || 'User'}</div>
              <div className="text-xs text-gray-400">
                {profile?.role === 'first_admin' ? 'Primary Admin'
                  : profile?.role === 'second_admin' ? 'Secondary Admin' : 'Member'}
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => router.push(`/${subdomain}/admin`)}
                className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded border transition-colors
                  ${pathname === `/${subdomain}/admin`
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'}`}>
                Admin
              </button>
            )}
            <button onClick={handleLogout}
              className="flex-shrink-0 px-3 py-1 text-xs font-medium rounded border border-gray-400 text-gray-600 hover:bg-gray-300 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* ══ Switch Group Modal ══════════════════════════════════ */}
      {showGroupPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Switch team</h3>
              <button onClick={() => setShowGroupPicker(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-2">
              {myGroups.map(g => (
                <button key={g.id} onClick={() => switchGroup(g.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                    ${g.id === groupId
                      ? 'border-teal-500 bg-teal-50 text-teal-700 font-semibold'
                      : 'border-gray-200 hover:border-teal-400 text-gray-800 hover:bg-teal-50'}`}>
                  {g.name}
                  {g.id === groupId && <span className="ml-2 text-xs font-normal text-teal-500">Current</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ Add Reminder Modal ══════════════════════════════════ */}
      {showAddRem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Add event</h3>
              <button onClick={() => { setShowAddRem(false); resetAddForm() }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                <TypeGrid current={remType} onSet={setRemType} />
              </div>
              <DateTimeFields
                startDate={remStartDate} endDate={remEndDate_}
                startTime={remStartTime} endTime={remEndTime}
                onStartDate={setRemStartDate} onEndDate={setRemEndDate_}
                onStartTime={setRemStartTime} onEndTime={setRemEndTime}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                <MemberSelector current={remAssigned} onSet={setRemAssigned} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pre-alert reminders</label>
                <div className="flex gap-3">
                  {[30, 7, 1].map(d => (
                    <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox"
                        checked={remPreAlerts.includes(d)}
                        onChange={e => setRemPreAlerts(prev =>
                          e.target.checked ? [...prev, d] : prev.filter(x => x !== d)
                        )}
                        className="rounded border-gray-300 text-teal-600" />
                      <span className="text-xs text-gray-600">{d === 1 ? '1 day' : `${d} days`}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-red-500">*</span></label>
                <textarea value={remContent} onChange={e => setRemContent(e.target.value)}
                  placeholder="Event details…" rows={3} className="input-field resize-none" autoFocus />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={() => { setShowAddRem(false); resetAddForm() }}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveReminder} disabled={remSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {remSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Reminder Detail / Edit Modal ════════════════════════ */}
      {selectedRem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">
                {detailMode === 'edit' ? 'Edit event' : 'Event details'}
              </h3>
              <button onClick={closeDetailRem} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {detailMode === 'view' ? (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {selectedRem.deleted ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                      <span className="text-xs text-red-500 font-semibold">Deleted</span>
                      {selectedRem.deleted_by_name && <span className="text-xs text-red-400">· By: {selectedRem.deleted_by_name}</span>}
                    </div>
                  ) : remEndDate(selectedRem) < todayStr ? (
                    <div className="px-3 py-1.5 bg-gray-100 rounded-lg">
                      <span className="text-xs text-gray-500 font-semibold">Past</span>
                    </div>
                  ) : null}
                  {!selectedRem.deleted && selectedRem.type && selectedRem.type !== 'others' && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[selectedRem.type] || TYPE_COLORS.others}`}>
                      {TYPE_LABELS[selectedRem.type] || selectedRem.type}
                    </span>
                  )}
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                    ${remPrimaryDate(selectedRem) === todayStr ? 'bg-amber-100 text-amber-700'
                    : remEndDate(selectedRem) < todayStr || selectedRem.deleted ? 'bg-gray-100 text-gray-500'
                    : 'bg-teal-50 text-teal-700'}`}>
                    <span>📅</span><span>{remFullDateLabel(selectedRem, todayStr)}</span>
                  </div>
                  {selectedRem.start_time && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span>🕐</span>
                      <span>{fmtTime(selectedRem.start_time)}{selectedRem.end_time ? ` – ${fmtTime(selectedRem.end_time)}` : ''}</span>
                    </div>
                  )}
                  {selectedRem.assigned_to_name && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span>👤</span><span>{selectedRem.assigned_to_name}</span>
                    </div>
                  )}
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap
                    ${selectedRem.deleted || remEndDate(selectedRem) < todayStr ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {selectedRem.content}
                  </p>
                </div>
                <div className="flex gap-2 px-6 py-4 border-t border-gray-200 flex-shrink-0 flex-wrap">
                  <button onClick={closeDetailRem}
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
                  {!selectedRem.deleted && (
                    <button onClick={() => startEditRem(selectedRem)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Edit</button>
                  )}
                  {!selectedRem.deleted && (
                    <button onClick={() => softDeleteReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Delete</button>
                  )}
                  {selectedRem.deleted && (currentUserId === selectedRem.deleted_by || isAdmin) && (
                    <button onClick={() => restoreReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Restore</button>
                  )}
                  {selectedRem.deleted && isAdmin && (
                    <button onClick={() => hardDeleteReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors">Delete permanently</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                    <TypeGrid current={editType} onSet={setEditType} />
                  </div>
                  <DateTimeFields
                    startDate={editStartDate} endDate={editEndDate_}
                    startTime={editStartTime} endTime={editEndTime}
                    onStartDate={setEditStartDate} onEndDate={setEditEndDate_}
                    onStartTime={setEditStartTime} onEndTime={setEditEndTime}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                    <MemberSelector current={editAssigned} onSet={setEditAssigned} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pre-alert reminders</label>
                    <div className="flex gap-3">
                      {[30, 7, 1].map(d => (
                        <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox"
                            checked={editPreAlerts.includes(d)}
                            onChange={e => setEditPreAlerts(prev =>
                              e.target.checked ? [...prev, d] : prev.filter(x => x !== d)
                            )}
                            className="rounded border-gray-300 text-teal-600" />
                          <span className="text-xs text-gray-600">{d === 1 ? '1 day' : `${d} days`}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-red-500">*</span></label>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={3} className="input-field resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
                  <button onClick={() => setDetailMode('view')}
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={saveEditRem} disabled={editSaving}
                    className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ All Events Modal ════════════════════════════════════ */}
      {showAllRem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">All events <span className="text-gray-400 font-normal text-sm">({upcoming.length})</span></h3>
              <button onClick={() => setShowAllRem(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {upcoming.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="upcoming" />)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
