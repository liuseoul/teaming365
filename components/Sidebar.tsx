'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClerk } from '@clerk/nextjs'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { encField, decField } from '@/lib/e2e'

const TYPE_LABELS: Record<string, string> = {
  // ── Legal ─────────────────────────────────────────────────
  court_hearing:          'Court Hearing',
  filing_deadline:        'Filing Deadline',
  consultation:           'Legal Consultation',
  statute_of_limitations: 'Limitation Period',
  // ── General ───────────────────────────────────────────────
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
  profiles?: { name: string }
}

type GroupInfo = { id: string; name: string }

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
  groupId: string
  groupName: string
  subdomain: string
  children?: React.ReactNode
}

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

function reminderUrgencyDot(primaryDate: string, today: string): string {
  if (primaryDate < today)   return 'bg-red-500'
  if (primaryDate === today) return 'bg-amber-400'
  const diff = (new Date(primaryDate).getTime() - new Date(today).getTime()) / 86400000
  if (diff <= 3)             return 'bg-yellow-400'
  return 'bg-teal-400'
}

export default function Sidebar({ profile, groupId, groupName, subdomain, children }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { signOut } = useClerk()

  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  const isAdmin    = ['first_admin', 'second_admin'].includes(profile?.role || '')
  const todayStr   = new Date().toISOString().split('T')[0]
  const today      = new Date().toISOString().slice(0, 10)

  const [currentUserId,   setCurrentUserId]   = useState<string | null>(null)
  const [reminders,       setReminders]       = useState<Reminder[]>([])
  const [displayReminders, setDisplayReminders] = useState<Reminder[]>([])
  const [members,         setMembers]         = useState<Member[]>([])
  const [myGroups,        setMyGroups]        = useState<GroupInfo[]>([])
  const [showGroupPicker, setShowGroupPicker] = useState(false)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showAllRem,      setShowAllRem]      = useState(false)

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

  const [selectedRem, setSelectedRem] = useState<Reminder | null>(null)
  const [detailMode,  setDetailMode]  = useState<'view' | 'edit'>('view')
  const [editType,       setEditType]       = useState('others')
  const [editStartDate,  setEditStartDate]  = useState(todayStr)
  const [editEndDate_,   setEditEndDate_]   = useState(todayStr)
  const [editStartTime,  setEditStartTime]  = useState('')
  const [editEndTime,    setEditEndTime]    = useState('')
  const [editContent,    setEditContent]    = useState('')
  const [editAssigned,   setEditAssigned]   = useState('')
  const [editPreAlerts,  setEditPreAlerts]  = useState<number[]>([])
  const [editSaving,     setEditSaving]     = useState(false)
  const [showCourtDates, setShowCourtDates] = useState(true)

  const [showUserMenu,          setShowUserMenu]          = useState(false)
  const [sidebarTodos,          setSidebarTodos]          = useState<any[]>([])
  const [displaySidebarTodos,   setDisplaySidebarTodos]   = useState<any[]>([])
  const [showAllTodos,          setShowAllTodos]          = useState(false)
  const [showAddTodo,           setShowAddTodo]           = useState(false)
  const [newTodoContent,        setNewTodoContent]        = useState('')
  const [newTodoAssignee,       setNewTodoAssignee]       = useState('')
  const [newTodoDueDate,        setNewTodoDueDate]        = useState('')
  const [todoSaving,            setTodoSaving]            = useState(false)

  useEffect(() => {
    const uid = profile?.id || null
    setCurrentUserId(uid)
    if (uid) loadMyGroups(uid)
    loadReminders()
    loadMembers()
    loadSidebarTodos()
  }, [groupId])

  useEffect(() => {
    setDisplaySidebarTodos(sidebarTodos.map((t: any) => ({
      ...t,
      content: decField(t.content, groupKey) || t.content,
    })))
  }, [sidebarTodos, groupKey])

  // Close user menu when clicking outside
  useEffect(() => {
    if (!showUserMenu) return
    function handler() { setShowUserMenu(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showUserMenu])

  async function addSidebarTodo() {
    if (!newTodoContent.trim()) return
    setTodoSaving(true)
    const { error } = await supabase.from('todos').insert({
      content: encField(newTodoContent.trim(), groupKey) ?? newTodoContent.trim(),
      assignee_abbrev: newTodoAssignee.trim() || null,
      due_date: newTodoDueDate || null,
      group_id: groupId,
      completed: false,
      deleted: false,
    })
    setTodoSaving(false)
    if (error) { alert('Failed: ' + error.message); return }
    setShowAddTodo(false); setNewTodoContent(''); setNewTodoAssignee(''); setNewTodoDueDate('')
    await loadSidebarTodos()
  }

  async function loadSidebarTodos() {
    const { data } = await supabase
      .from('todos')
      .select('id, content, assignee_abbrev, due_date')
      .eq('group_id', groupId)
      .eq('completed', false)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(30)
    setSidebarTodos(data || [])
  }

  async function completeSidebarTodo(id: string) {
    await supabase.from('todos').update({
      completed: true,
      completed_at: new Date().toISOString(),
      completed_by_name: profile?.name || '',
    }).eq('id', id).eq('group_id', groupId)
    setSidebarTodos(prev => prev.filter((t: any) => t.id !== id))
  }

  async function loadReminders() {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('group_id', groupId)
      .order('due_date', { ascending: true })
    if (!error) setReminders(data || [])
  }

  useEffect(() => {
    setDisplayReminders(reminders.map(r => ({ ...r, content: decField(r.content, groupKey) })))
  }, [reminders, groupKey])

  async function loadMembers() {
    const { data } = await supabase
      .from('group_members')
      .select('profiles(id, name)')
      .eq('group_id', groupId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMembers((data || []).map((m: any) => ({ id: m.profiles?.id || '', name: m.profiles?.name || '' })).filter(m => m.id))
  }

  async function loadMyGroups(userId: string) {
    const { data } = await supabase
      .from('group_members')
      .select('groups(id, name)')
      .eq('user_id', userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMyGroups((data || []).map((m: any) => ({ id: m.groups?.id || '', name: m.groups?.name || '' })).filter(g => g.id))
  }

  async function switchGroup(gid: string) {
    document.cookie = `qt_group=${gid}; path=/; max-age=86400; SameSite=Lax`
    setShowGroupPicker(false)
    // Look up the subdomain for the new group
    const { data: grp } = await supabase.from('groups').select('subdomain').eq('id', gid).single()
    if (grp?.subdomain) {
      router.push(`/${grp.subdomain}/projects`)
    } else {
      router.push('/projects')
    }
    router.refresh()
  }

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
      group_id: groupId,
      created_by: profile!.id,
    })
    if (error) { alert('Save failed: ' + error.message) }
    else { setShowAddRem(false); resetAddForm(); await loadReminders() }
    setRemSaving(false)
  }

  function resetAddForm() {
    setRemContent(''); setRemStartDate(todayStr); setRemEndDate_(todayStr)
    setRemType('others'); setRemStartTime(''); setRemEndTime(''); setRemAssigned('')
    setRemPreAlerts([])
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
      assigned_to_name: editAssigned || null,
      pre_alert_days: editPreAlerts,
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

  // ── Inner render helpers ──────────────────────────────────
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
      variant === 'upcoming' && isToday ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
      : variant === 'upcoming'          ? `${rowBg} border-gray-200 hover:border-teal-300 hover:bg-teal-50/40`
      : variant === 'past'              ? 'bg-gray-50 border-gray-100 opacity-60 hover:opacity-80'
      : 'bg-red-50/40 border-red-100 opacity-50 hover:opacity-70'

    // Feature 15 — countdown days
    const daysUntil = variant === 'upcoming' && !isToday
      ? Math.ceil((new Date(primDate).getTime() - new Date(todayStr).getTime()) / 86400000)
      : null
    const isPreAlertDay = daysUntil !== null && (r.pre_alert_days || []).includes(daysUntil)

    return (
      <button onClick={() => openDetailRem(r)}
        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border transition-all ${cls}`}>
        {variant === 'upcoming' && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${reminderUrgencyDot(primDate, today)}`} />
        )}
        <span className={`text-xs font-bold mt-0.5 flex-shrink-0 min-w-9
          ${variant === 'upcoming' && isToday ? 'text-amber-600' : variant === 'upcoming' ? 'text-teal-600' : 'text-gray-400'}`}>
          {dateLabel}
        </span>
        <div className="min-w-0 flex-1">
          <span className={`text-sm leading-snug line-clamp-2 block
            ${variant === 'deleted' ? 'line-through text-gray-400'
            : variant === 'past'    ? 'line-through text-gray-500'
            : isToday               ? 'text-amber-800 font-medium'
            : 'text-gray-800'}`}>
            {r.content}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {variant === 'upcoming' && r.type && r.type !== 'others' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[r.type] || TYPE_COLORS.others}`}>
                {TYPE_LABELS[r.type] || r.type}
              </span>
            )}
            {/* Feature 15 — countdown badge */}
            {daysUntil !== null && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                ${isPreAlertDay ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                  : daysUntil <= 7 ? 'bg-rose-50 text-rose-500'
                  : 'bg-gray-100 text-gray-400'}`}>
                {isPreAlertDay ? `⚡ ${daysUntil}d` : `${daysUntil}d`}
              </span>
            )}
            {variant === 'upcoming' && r.assigned_to_name && (
              <span className="text-[10px] text-indigo-500 font-medium">@{r.assigned_to_name}</span>
            )}
            {variant === 'upcoming' && r.start_time && (
              <span className="text-[10px] text-gray-400">
                {fmtTime(r.start_time)}{r.end_time ? `–${fmtTime(r.end_time)}` : ''}
              </span>
            )}
            {variant === 'past'    && <span className="text-[10px] text-gray-400">Past</span>}
            {variant === 'deleted' && r.deleted_by_name && (
              <span className="text-[10px] text-red-400">Deleted · {r.deleted_by_name}</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden">

        {/* ── TOP NAVIGATION BAR ──────────────────────────────── */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-20 no-print">

          {/* ── Row 1: Logo + right actions ── */}
          <div className="flex items-center px-4 h-11 gap-3 border-b border-gray-100">
            {/* Logo */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-7 h-7 bg-slate-800 rounded-md flex items-center justify-center text-xs font-bold text-white">Q</div>
              <div className="min-w-0 hidden sm:block">
                <div className="text-sm font-semibold text-gray-900 leading-none truncate max-w-36">{groupName}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                  团队<span className="font-black text-slate-600">365</span>
                </div>
              </div>
            </div>

            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {myGroups.length > 1 && (
                <button onClick={() => setShowGroupPicker(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200">
                  🔀 <span className="hidden lg:inline">Switch</span>
                </button>
              )}
              {isAdmin && (
                <button onClick={() => router.push(`/${subdomain}/admin`)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors
                    ${pathname === `/${subdomain}/admin`
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'text-slate-700 border-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-800'}`}>
                  ⚙️ Admin
                </button>
              )}
              {/* User avatar + dropdown */}
              <div className="relative">
                <button onClick={e => { e.stopPropagation(); setShowUserMenu(v => !v) }}
                  className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded hover:bg-gray-100 transition-colors">
                  <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                    {(profile?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-700 hidden sm:inline max-w-24 truncate">{profile?.name}</span>
                  <span className="text-gray-400 text-[9px]">▾</span>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm font-semibold text-gray-900">{profile?.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {profile?.role === 'first_admin' ? 'Primary Admin'
                          : profile?.role === 'second_admin' ? 'Secondary Admin' : 'Member'}
                      </div>
                    </div>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
                      <span>🚪</span><span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 2: Folder-tab navigation ── */}
          <div className="flex items-end px-3 gap-0.5 overflow-x-auto">
            {[
              { href: `/${subdomain}/dashboard`, label: 'Today',     icon: '🗓️' },
              { href: `/${subdomain}/projects`,  label: 'Matters',   icon: '📋' },
              { href: `/${subdomain}/analytics`, label: 'Analytics', icon: '📊', adminOnly: true },
              { href: `/${subdomain}/invoice`,   label: 'Invoice',   icon: '🧾', adminOnly: true },
              { href: `/${subdomain}/my-stats`,   label: 'My Stats',   icon: '📈' },
              { href: `/${subdomain}/team-stats`, label: 'Team Stats', icon: '👥', adminOnly: true },
            ]
              .filter(item => !item.adminOnly || isAdmin)
              .map(item => {
                const isActive = pathname === item.href
                return (
                  <button key={item.label}
                    onClick={() => router.push(item.href)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-md border whitespace-nowrap flex-shrink-0 transition-all
                      ${isActive
                        ? 'bg-white border-gray-300 border-b-0 text-slate-900 font-semibold -mb-px z-10 shadow-sm'
                        : 'bg-slate-50 border-transparent text-gray-500 hover:bg-white hover:text-slate-800 hover:border-gray-200 hover:border-b-0 hover:-mb-px'}`}>
                    <span className="text-sm leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
          </div>
        </header>

        {/* ── BODY ─────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* Main content (injected by page) */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {children}
          </div>

          {/* ── RIGHT PANEL ──────────────────────────────────── */}
          <div className="w-72 bg-gray-50 border-l border-gray-200 flex flex-col flex-shrink-0 no-print">

            {/* ── TODOS ──────────────────────────────────────── */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200">
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex-1">📝 Todos</span>
                {displaySidebarTodos.length > 0 && (
                  <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                    {displaySidebarTodos.length}
                  </span>
                )}
                <button onClick={() => setShowAllTodos(true)}
                  className="text-[10px] font-semibold px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  Show All
                </button>
                <button onClick={() => setShowAddTodo(true)}
                  className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-700 transition-colors">
                  + Add
                </button>
              </div>
              <div className="px-2 pb-2 space-y-0.5 max-h-52 overflow-y-auto">
                {displaySidebarTodos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">All clear ✓</p>
                ) : displaySidebarTodos.slice(0, 8).map((todo: any) => (
                  <div key={todo.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-slate-50 group transition-colors">
                    <button
                      onClick={() => completeSidebarTodo(todo.id)}
                      className="w-4 h-4 rounded border-2 border-gray-300 group-hover:border-slate-500 flex-shrink-0 mt-0.5 transition-colors"
                      title="Mark complete" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-800 leading-snug line-clamp-2">{todo.content}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {todo.assignee_abbrev && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1 rounded">{todo.assignee_abbrev}</span>
                        )}
                        {todo.due_date && (
                          <span className={`text-[10px] font-medium ${todo.due_date < todayStr ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
                            {todo.due_date.slice(5, 7)}/{todo.due_date.slice(8, 10)}
                            {todo.due_date < todayStr ? ' ⚠' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {displaySidebarTodos.length > 8 && (
                  <button onClick={() => setShowAllTodos(true)}
                    className="w-full text-[10px] text-indigo-600 hover:text-indigo-800 py-1 text-center font-medium transition-colors">
                    +{displaySidebarTodos.length - 8} more
                  </button>
                )}
              </div>
            </div>

            {/* ── SCHEDULE ───────────────────────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex-1">📅 Schedule</span>
                <button onClick={() => setShowAllRem(true)}
                  className="text-[10px] font-semibold px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  Show All
                </button>
                <button onClick={() => setShowAddRem(true)}
                  className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-700 transition-colors">
                  + Add
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">

            {/* Feature 15 — Pre-alerts firing today */}
            {(() => {
              const preAlerts = upcoming.filter(r => {
                if (!r.pre_alert_days || r.pre_alert_days.length === 0) return false
                const d = Math.ceil((new Date(remPrimaryDate(r)).getTime() - new Date(todayStr).getTime()) / 86400000)
                return r.pre_alert_days.includes(d)
              })
              if (preAlerts.length === 0) return null
              return (
                <div className="mb-2">
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

            {/* Feature 16 — Court dates (next 14 days) */}
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

          </div>{/* end right panel */}
        </div>{/* end body */}
      </div>{/* end app shell */}

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

      {/* ══ All Upcoming Reminders Modal ════════════════════════ */}
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

      {/* ══ Add Todo Modal ══════════════════════════════════════ */}
      {showAddTodo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">Add Todo</h3>
              <button onClick={() => setShowAddTodo(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task <span className="text-red-500">*</span></label>
                <textarea value={newTodoContent} onChange={e => setNewTodoContent(e.target.value)}
                  placeholder="What needs to be done?" rows={3} className="input-field resize-none" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                  <input type="text" value={newTodoAssignee} onChange={e => setNewTodoAssignee(e.target.value)}
                    placeholder="e.g. LW" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
                  <input type="date" value={newTodoDueDate} onChange={e => setNewTodoDueDate(e.target.value)}
                    className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAddTodo(false); setNewTodoContent(''); setNewTodoAssignee(''); setNewTodoDueDate('') }}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={addSidebarTodo} disabled={todoSaving || !newTodoContent.trim()}
                className="flex-1 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-40 transition-colors">
                {todoSaving ? 'Saving…' : 'Add Todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Show All Todos Modal ════════════════════════════════ */}
      {showAllTodos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">All Open Todos</h3>
                <p className="text-xs text-gray-400 mt-0.5">{displaySidebarTodos.length} task{displaySidebarTodos.length !== 1 ? 's' : ''} remaining</p>
              </div>
              <button onClick={() => setShowAllTodos(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {displaySidebarTodos.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">All clear ✓</p>
              ) : displaySidebarTodos.map((todo: any) => (
                <div key={todo.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 group transition-colors border border-transparent hover:border-gray-200">
                  <button
                    onClick={async () => { await completeSidebarTodo(todo.id) }}
                    className="w-4 h-4 rounded border-2 border-gray-300 group-hover:border-slate-500 flex-shrink-0 mt-0.5 transition-colors"
                    title="Mark complete" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 leading-snug">{todo.content}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {todo.assignee_abbrev && (
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{todo.assignee_abbrev}</span>
                      )}
                      {todo.due_date && (
                        <span className={`text-[10px] font-medium ${todo.due_date < todayStr ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
                          Due {todo.due_date.slice(5, 7)}/{todo.due_date.slice(8, 10)}{todo.due_date < todayStr ? ' ⚠' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => { setShowAllTodos(false); setShowAddTodo(true) }}
                className="w-full py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                + Add new todo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
