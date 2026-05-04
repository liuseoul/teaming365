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

function StatsTable({ loading, queried, records, timeLogs, todos, showOperator, groupByProject }: {
  loading: boolean; queried: boolean
  records: any[]; timeLogs: any[]; todos: any[]
  showOperator: boolean
  groupByProject?: boolean
}) {
  if (loading) return <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
  if (!queried) return <p className="text-sm text-gray-400 text-center py-8">Select a date and click Confirm</p>
  if (records.length === 0 && timeLogs.length === 0 && todos.length === 0)
    return <p className="text-sm text-gray-400 text-center py-8">No records for this period</p>

  function durMins(started: string, finished: string | null) {
    if (!finished) return '—'
    const m = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 60000)
    return m > 0 ? `${m} min` : '—'
  }

  // Build table rows for records with optional project sub-headers
  function renderRecordRows() {
    if (!groupByProject) {
      return records.map((r: any) => (
        <tr key={r.id} className="hover:bg-gray-50">
          <td className="px-2 py-1.5 border border-gray-200 text-gray-600">{r.projects?.name || '—'}</td>
          <td className="px-2 py-1.5 border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">{r.content}</td>
          {showOperator && <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{r.profiles?.name || '—'}</td>}
        </tr>
      ))
    }
    const rows: React.ReactNode[] = []
    let lastProjectId: string | null = null
    records.forEach((r: any) => {
      const pid = r.projects?.id || null
      if (pid !== lastProjectId) {
        lastProjectId = pid
        const colSpan = showOperator ? 3 : 2
        rows.push(
          <tr key={`ph-${pid || 'none'}-${r.id}`} className="bg-teal-50">
            <td colSpan={colSpan} className="px-2 py-1 border border-gray-200 text-teal-700 font-semibold text-xs">
              {r.projects?.name || 'Unassigned'}
            </td>
          </tr>
        )
      }
      rows.push(
        <tr key={r.id} className="hover:bg-gray-50">
          <td className="px-2 py-1.5 border border-gray-200 text-gray-600">{r.projects?.name || '—'}</td>
          <td className="px-2 py-1.5 border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">{r.content}</td>
          {showOperator && <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{r.profiles?.name || '—'}</td>}
        </tr>
      )
    })
    return rows
  }

  // Build table rows for time logs with optional project sub-headers
  function renderTimeLogRows() {
    if (!groupByProject) {
      return timeLogs.map((l: any) => {
        const startStr = new Date(l.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'
        return (
          <tr key={l.id} className="hover:bg-gray-50">
            <td className="px-2 py-1.5 border border-gray-200 text-gray-600">{l.projects?.name || '—'}</td>
            <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{startStr}–{endStr}</td>
            <td className="px-2 py-1.5 border border-gray-200 text-teal-600 font-semibold">{durMins(l.started_at, l.finished_at)}</td>
            <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{l.description || '—'}</td>
            {showOperator && <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{l.profiles?.name || '—'}</td>}
          </tr>
        )
      })
    }
    const rows: React.ReactNode[] = []
    let lastProjectId: string | null = null
    timeLogs.forEach((l: any) => {
      const pid = l.projects?.id || null
      if (pid !== lastProjectId) {
        lastProjectId = pid
        const colSpan = showOperator ? 5 : 4
        rows.push(
          <tr key={`ph-${pid || 'none'}-${l.id}`} className="bg-teal-50">
            <td colSpan={colSpan} className="px-2 py-1 border border-gray-200 text-teal-700 font-semibold text-xs">
              {l.projects?.name || 'Unassigned'}
            </td>
          </tr>
        )
      }
      const startStr = new Date(l.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'
      rows.push(
        <tr key={l.id} className="hover:bg-gray-50">
          <td className="px-2 py-1.5 border border-gray-200 text-gray-600">{l.projects?.name || '—'}</td>
          <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{startStr}–{endStr}</td>
          <td className="px-2 py-1.5 border border-gray-200 text-teal-600 font-semibold">{durMins(l.started_at, l.finished_at)}</td>
          <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{l.description || '—'}</td>
          {showOperator && <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{l.profiles?.name || '—'}</td>}
        </tr>
      )
    })
    return rows
  }

  // Group todos by completed_by_name for group view
  function renderTodos() {
    if (!showOperator) {
      // Personal view — flat list
      return (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">Content</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-10">Assignee</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">Done at</th>
            </tr>
          </thead>
          <tbody>
            {todos.map((t: any) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{t.content}</td>
                <td className="px-2 py-1.5 border border-gray-200 text-center text-teal-600 font-bold">{t.assignee_abbrev || '—'}</td>
                <td className="px-2 py-1.5 border border-gray-200 text-gray-500">
                  {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    // Group view — group by completed_by_name
    const groups: { operator: string; items: any[] }[] = []
    const seenOps = new Map<string, number>()
    todos.forEach((t: any) => {
      const op = t.completed_by_name || '—'
      if (seenOps.has(op)) {
        groups[seenOps.get(op)!].items.push(t)
      } else {
        seenOps.set(op, groups.length)
        groups.push({ operator: op, items: [t] })
      }
    })
    return (
      <div className="space-y-3">
        {groups.map(({ operator, items }) => (
          <div key={operator}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-gray-700">{operator}</span>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {items.map((t: any) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{t.content}</td>
                    <td className="px-2 py-1.5 border border-gray-200 text-center text-teal-600 font-bold w-10">{t.assignee_abbrev || '—'}</td>
                    <td className="px-2 py-1.5 border border-gray-200 text-gray-500 w-16">
                      {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {records.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Work Records <span className="text-gray-400 font-normal">({records.length})</span>
          </h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-24">Matter</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">Content</th>
                {showOperator && <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">By</th>}
              </tr>
            </thead>
            <tbody>
              {renderRecordRows()}
            </tbody>
          </table>
        </div>
      )}

      {timeLogs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Time Entries <span className="text-gray-400 font-normal">({timeLogs.length})</span>
          </h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-24">Matter</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-20">Period</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">Duration</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">Content</th>
                {showOperator && <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">By</th>}
              </tr>
            </thead>
            <tbody>
              {renderTimeLogRows()}
            </tbody>
          </table>
        </div>
      )}

      {todos.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Completed Todos <span className="text-gray-400 font-normal">({todos.length})</span>
          </h4>
          {renderTodos()}
        </div>
      )}
    </div>
  )
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

  const [showPersonalStats,  setShowPersonalStats]  = useState(false)
  const [personalDate,       setPersonalDate]       = useState(todayStr)
  const [personalLoading,    setPersonalLoading]    = useState(false)
  const [personalQueried,    setPersonalQueried]    = useState(false)
  const [personalRecords,    setPersonalRecords]    = useState<any[]>([])
  const [personalTimeLogs,   setPersonalTimeLogs]   = useState<any[]>([])
  const [personalTodos,      setPersonalTodos]      = useState<any[]>([])

  const [showGroupStats, setShowGroupStats] = useState(false)
  const [groupDate,      setGroupDate]      = useState(todayStr)
  const [groupLoading,   setGroupLoading]   = useState(false)
  const [groupQueried,   setGroupQueried]   = useState(false)
  const [groupRecords,   setGroupRecords]   = useState<any[]>([])
  const [groupTimeLogs,  setGroupTimeLogs]  = useState<any[]>([])
  const [groupTodos,     setGroupTodos]     = useState<any[]>([])

  const [showUserMenu,          setShowUserMenu]          = useState(false)
  const [sidebarTodos,          setSidebarTodos]          = useState<any[]>([])
  const [displaySidebarTodos,   setDisplaySidebarTodos]   = useState<any[]>([])

  // range-mode additions
  const [personalMode,       setPersonalMode]       = useState<'single' | 'range'>('single')
  const [personalRangeStart, setPersonalRangeStart] = useState(new Date().toISOString().split('T')[0].slice(0, 7) + '-01')
  const [personalRangeEnd,   setPersonalRangeEnd]   = useState(new Date().toISOString().split('T')[0])
  const [groupMode,          setGroupMode]          = useState<'single' | 'range'>('single')
  const [groupRangeStart,    setGroupRangeStart]    = useState(new Date().toISOString().split('T')[0].slice(0, 7) + '-01')
  const [groupRangeEnd,      setGroupRangeEnd]      = useState(new Date().toISOString().split('T')[0])

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

  async function loadPersonalStats() {
    if (!currentUserId) return
    setPersonalLoading(true); setPersonalQueried(true)
    const startDay = personalMode === 'range' ? personalRangeStart : personalDate
    const endDay   = personalMode === 'range' ? personalRangeEnd   : personalDate
    if (endDay < startDay) { alert('End date cannot be before start date'); setPersonalLoading(false); setPersonalQueried(false); return }
    const s = `${startDay}T00:00:00.000Z`, e = `${endDay}T23:59:59.999Z`
    const [{ data: recs }, { data: logs }, { data: tdos }] = await Promise.all([
      supabase.from('work_records')
        .select('id, content, created_at, projects(name)')
        .eq('author_id', currentUserId).eq('deleted', false).eq('group_id', groupId)
        .gte('created_at', s).lte('created_at', e).order('created_at', { ascending: true }),
      supabase.from('time_logs')
        .select('id, started_at, finished_at, description, projects(name)')
        .eq('member_id', currentUserId).eq('deleted', false).eq('group_id', groupId)
        .gte('started_at', s).lte('started_at', e).order('started_at', { ascending: true }),
      supabase.from('todos')
        .select('id, content, assignee_abbrev, completed_at, completed_by_name')
        .eq('completed', true).eq('deleted', false).eq('group_id', groupId)
        .eq('completed_by_name', profile?.name || '')
        .gte('completed_at', s).lte('completed_at', e).order('completed_at', { ascending: true }),
    ])
    setPersonalRecords((recs || []).map((r: any) => ({
      ...r,
      content: decField(r.content, groupKey),
      projects: r.projects ? { ...r.projects, name: decField(r.projects.name, groupKey) } : r.projects,
    })))
    setPersonalTimeLogs((logs || []).map((l: any) => ({
      ...l,
      description: decField(l.description, groupKey),
      projects: l.projects ? { ...l.projects, name: decField(l.projects.name, groupKey) } : l.projects,
    })))
    setPersonalTodos((tdos || []).map((t: any) => ({ ...t, content: decField(t.content, groupKey) })))
    setPersonalLoading(false)
  }

  async function loadGroupStats() {
    setGroupLoading(true); setGroupQueried(true)
    const startDay = groupMode === 'range' ? groupRangeStart : groupDate
    const endDay   = groupMode === 'range' ? groupRangeEnd   : groupDate
    if (endDay < startDay) { alert('End date cannot be before start date'); setGroupLoading(false); setGroupQueried(false); return }
    const s = `${startDay}T00:00:00.000Z`, e = `${endDay}T23:59:59.999Z`
    const [{ data: recs }, { data: logs }, { data: tdos }] = await Promise.all([
      supabase.from('work_records')
        .select('id, content, created_at, profiles!work_records_author_id_fkey(name), projects(id, name, created_at)')
        .eq('deleted', false).eq('group_id', groupId)
        .gte('created_at', s).lte('created_at', e).order('created_at', { ascending: true }),
      supabase.from('time_logs')
        .select('id, started_at, finished_at, description, profiles!time_logs_member_id_fkey(name), projects(id, name, created_at)')
        .eq('deleted', false).eq('group_id', groupId)
        .gte('started_at', s).lte('started_at', e).order('started_at', { ascending: true }),
      supabase.from('todos')
        .select('id, content, assignee_abbrev, completed_at, completed_by_name')
        .eq('completed', true).eq('deleted', false).eq('group_id', groupId)
        .gte('completed_at', s).lte('completed_at', e).order('completed_at', { ascending: true }),
    ])

    // Sort work records: group by project ordered by project.created_at asc, then by record created_at asc within each project
    const decRecs = (recs || []).map((r: any) => ({
      ...r,
      content: decField(r.content, groupKey),
      projects: r.projects ? { ...r.projects, name: decField(r.projects.name, groupKey) } : r.projects,
    }))
    decRecs.sort((a: any, b: any) => {
      const aTime = a.projects?.created_at || ''
      const bTime = b.projects?.created_at || ''
      if (aTime !== bTime) return aTime.localeCompare(bTime)
      return (a.created_at || '').localeCompare(b.created_at || '')
    })
    setGroupRecords(decRecs)

    // Sort time logs: group by project ordered by project.created_at asc, then by started_at asc within each project
    const decLogs = (logs || []).map((l: any) => ({
      ...l,
      description: decField(l.description, groupKey),
      projects: l.projects ? { ...l.projects, name: decField(l.projects.name, groupKey) } : l.projects,
    }))
    decLogs.sort((a: any, b: any) => {
      const aTime = a.projects?.created_at || ''
      const bTime = b.projects?.created_at || ''
      if (aTime !== bTime) return aTime.localeCompare(bTime)
      return (a.started_at || '').localeCompare(b.started_at || '')
    })
    setGroupTimeLogs(decLogs)
    setGroupTodos((tdos || []).map((t: any) => ({ ...t, content: decField(t.content, groupKey) })))
    setGroupLoading(false)
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
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-2 flex-shrink-0 z-20 no-print">

          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-4 flex-shrink-0">
            <div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">Q</div>
            <div className="min-w-0 hidden sm:block">
              <div className="text-sm font-semibold text-gray-900 leading-none truncate max-w-32">{groupName}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                团队<span className="font-black text-amber-500">365</span>
              </div>
            </div>
          </div>

          {/* Page nav links */}
          <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
            {[
              { href: `/${subdomain}/dashboard`, label: 'Today',     icon: '🗓️' },
              { href: `/${subdomain}/projects`,  label: 'Matters',   icon: '📋' },
              ...(isAdmin ? [
                { href: `/${subdomain}/admin`,     label: 'Admin',     icon: '⚙️' },
                { href: `/${subdomain}/invoice`,   label: 'Invoice',   icon: '🧾' },
                { href: `/${subdomain}/analytics`, label: 'Analytics', icon: '📊' },
              ] : []),
            ].map(item => (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0
                  ${pathname === item.href ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <span className="text-base leading-none">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right side: stats + user */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setShowPersonalStats(true); setPersonalRecords([]); setPersonalTimeLogs([]); setPersonalTodos([]); setPersonalQueried(false) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              <span>📊</span><span className="hidden xl:inline text-xs">My Stats</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => { setShowGroupStats(true); setGroupRecords([]); setGroupTimeLogs([]); setGroupTodos([]); setGroupQueried(false) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                <span>👥</span><span className="hidden xl:inline text-xs">Team</span>
              </button>
            )}
            {myGroups.length > 1 && (
              <button onClick={() => setShowGroupPicker(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                <span>🔀</span><span className="hidden xl:inline text-xs">Switch</span>
              </button>
            )}
            {/* User avatar + dropdown */}
            <div className="relative ml-1">
              <button onClick={e => { e.stopPropagation(); setShowUserMenu(v => !v) }}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {(profile?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:inline max-w-28 truncate">{profile?.name}</span>
                <span className="text-gray-400 text-[10px]">▾</span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <div className="text-sm font-semibold text-gray-900">{profile?.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {profile?.role === 'first_admin' ? 'Primary Admin'
                        : profile?.role === 'second_admin' ? 'Secondary Admin' : 'Member'}
                    </div>
                  </div>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <span>🚪</span><span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── BODY ─────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* Main content (injected by page) */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {children}
          </div>

          {/* ── RIGHT PANEL ──────────────────────────────────── */}
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 no-print">

            {/* ── TODOS ──────────────────────────────────────── */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📝 Todos</span>
                {displaySidebarTodos.length > 0 && (
                  <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full font-semibold">
                    {displaySidebarTodos.length} open
                  </span>
                )}
              </div>
              <div className="px-2 pb-2 space-y-0.5 max-h-56 overflow-y-auto">
                {displaySidebarTodos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">All done ✓</p>
                ) : displaySidebarTodos.map((todo: any) => (
                  <div key={todo.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group transition-colors">
                    <button
                      onClick={() => completeSidebarTodo(todo.id)}
                      className="w-4 h-4 rounded border-2 border-gray-300 group-hover:border-teal-400 hover:!border-teal-500 hover:bg-teal-50 flex-shrink-0 mt-0.5 transition-colors"
                      title="Mark complete" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-800 leading-snug line-clamp-2">{todo.content}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {todo.assignee_abbrev && (
                          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1 rounded">{todo.assignee_abbrev}</span>
                        )}
                        {todo.due_date && (
                          <span className={`text-[10px] font-medium ${todo.due_date < todayStr ? 'text-red-500' : 'text-gray-400'}`}>
                            {todo.due_date.slice(5, 7)}/{todo.due_date.slice(8, 10)}
                            {todo.due_date < todayStr ? ' ⚠️' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-gray-200 mx-3 flex-shrink-0" />

            {/* ── SCHEDULE ───────────────────────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📅 Schedule</span>
                <div className="flex items-center gap-1.5">
                  {upcoming.length > 0 && (
                    <button onClick={() => setShowAllRem(true)}
                      className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300 hover:border-teal-400 transition-colors">
                      View all
                    </button>
                  )}
                  <button onClick={() => setShowAddRem(true)}
                    className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300 hover:border-teal-400 transition-colors">
                    + Add
                  </button>
                </div>
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

      {/* ══ Personal Daily Stats Modal ══════════════════════════ */}
      {showPersonalStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">My Work Stats</h3>
                <p className="text-xs text-gray-400 mt-0.5">{profile?.name}</p>
              </div>
              <button onClick={() => setShowPersonalStats(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-3">
              <div className="flex gap-2">
                <button onClick={() => { setPersonalMode('single'); setPersonalQueried(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${personalMode === 'single'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'text-gray-600 hover:bg-gray-100 border-gray-200'}`}>
                  Single day
                </button>
                <button onClick={() => { setPersonalMode('range'); setPersonalQueried(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${personalMode === 'range'
                      ? 'bg-rose-400 text-white border-rose-400'
                      : 'bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100'}`}>
                  Range
                </button>
              </div>
              <div className="flex items-center gap-3">
                {personalMode === 'single' ? (
                  <input type="date" value={personalDate}
                    onChange={e => { setPersonalDate(e.target.value); setPersonalQueried(false) }}
                    className="input-field w-44" />
                ) : (
                  <>
                    <input type="date" value={personalRangeStart}
                      onChange={e => { setPersonalRangeStart(e.target.value); setPersonalQueried(false) }}
                      className="input-field w-40" />
                    <span className="text-sm text-gray-400">to</span>
                    <input type="date" value={personalRangeEnd} min={personalRangeStart}
                      onChange={e => { setPersonalRangeEnd(e.target.value); setPersonalQueried(false) }}
                      className="input-field w-40" />
                  </>
                )}
                <button onClick={loadPersonalStats} disabled={personalLoading}
                  className={`px-5 py-2 text-white text-sm font-medium rounded-lg disabled:bg-gray-200 transition-colors
                    ${personalMode === 'range'
                      ? 'bg-rose-400 hover:bg-rose-500'
                      : 'bg-teal-600 hover:bg-teal-700'}`}>
                  {personalLoading ? 'Loading…' : 'Confirm'}
                </button>
                {personalQueried && !personalLoading && (
                  <span className="text-xs text-gray-400">{personalRecords.length + personalTimeLogs.length + personalTodos.length} total</span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <StatsTable loading={personalLoading} queried={personalQueried}
                records={personalRecords} timeLogs={personalTimeLogs} todos={personalTodos} showOperator={false} />
            </div>
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

      {/* ══ Group Daily Stats Modal (admin) ═════════════════════ */}
      {showGroupStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Team Stats</h3>
              <button onClick={() => setShowGroupStats(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-3">
              <div className="flex gap-2">
                <button onClick={() => { setGroupMode('single'); setGroupQueried(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${groupMode === 'single'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'text-gray-600 hover:bg-gray-100 border-gray-200'}`}>
                  Single day
                </button>
                <button onClick={() => { setGroupMode('range'); setGroupQueried(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${groupMode === 'range'
                      ? 'bg-rose-400 text-white border-rose-400'
                      : 'bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100'}`}>
                  Range
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {groupMode === 'single' ? (
                  <input type="date" value={groupDate}
                    onChange={e => { setGroupDate(e.target.value); setGroupQueried(false) }}
                    className="input-field w-44" />
                ) : (
                  <>
                    <input type="date" value={groupRangeStart}
                      onChange={e => { setGroupRangeStart(e.target.value); setGroupQueried(false) }}
                      className="input-field w-40" />
                    <span className="text-sm text-gray-400">to</span>
                    <input type="date" value={groupRangeEnd} min={groupRangeStart}
                      onChange={e => { setGroupRangeEnd(e.target.value); setGroupQueried(false) }}
                      className="input-field w-40" />
                  </>
                )}
                <button onClick={loadGroupStats} disabled={groupLoading}
                  className={`px-5 py-2 text-white text-sm font-medium rounded-lg disabled:bg-gray-200 transition-colors
                    ${groupMode === 'range'
                      ? 'bg-rose-400 hover:bg-rose-500'
                      : 'bg-teal-600 hover:bg-teal-700'}`}>
                  {groupLoading ? 'Loading…' : 'Confirm'}
                </button>
                {groupQueried && !groupLoading && (
                  <span className="text-xs text-gray-400">{groupRecords.length + groupTimeLogs.length + groupTodos.length} total</span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <StatsTable loading={groupLoading} queried={groupQueried}
                records={groupRecords} timeLogs={groupTimeLogs} todos={groupTodos} showOperator={true} groupByProject={true} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
