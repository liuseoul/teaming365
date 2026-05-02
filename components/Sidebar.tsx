'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClerk } from '@clerk/nextjs/legacy'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { encField, decField } from '@/lib/e2e'

const TYPE_LABELS: Record<string, string> = {
  // ── 法律专项 ──────────────────────────────────────
  court_hearing:          '开庭/庭审',
  filing_deadline:        '提交截止日',
  consultation:           '法律咨询',
  statute_of_limitations: '诉讼时效',
  // ── 通用日程 ──────────────────────────────────────
  online_meeting:         '线上会议',
  visiting:               '拜访',
  business_travel:        '出差',
  personal_leave:         '请假',
  visiting_reception:     '接待访客',
  others:                 '其他',
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
  profiles?: { name: string }
}

type GroupInfo = { id: string; name: string }

interface SidebarProps {
  profile: { id: string; name: string; role: string } | null
  groupId: string
  groupName: string
  subdomain: string
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
  return sd === ed ? (sd === today ? '今天 · ' : '') + fmt(sd) : fmt(sd) + ' – ' + fmt(ed)
}

function StatsTable({ loading, queried, records, timeLogs, todos, showOperator, groupByProject }: {
  loading: boolean; queried: boolean
  records: any[]; timeLogs: any[]; todos: any[]
  showOperator: boolean
  groupByProject?: boolean
}) {
  if (loading) return <p className="text-sm text-gray-400 text-center py-8">查询中…</p>
  if (!queried) return <p className="text-sm text-gray-400 text-center py-8">请选择日期后点击确认</p>
  if (records.length === 0 && timeLogs.length === 0 && todos.length === 0)
    return <p className="text-sm text-gray-400 text-center py-8">该日暂无记录</p>

  function durMins(started: string, finished: string | null) {
    if (!finished) return '—'
    const m = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 60000)
    return m > 0 ? `${m} 分钟` : '—'
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
              {r.projects?.name || '无案件'}
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
        const startStr = new Date(l.started_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'
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
              {l.projects?.name || '无案件'}
            </td>
          </tr>
        )
      }
      const startStr = new Date(l.started_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'
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
              <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-10">负责</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">完成时间</th>
            </tr>
          </thead>
          <tbody>
            {todos.map((t: any) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{t.content}</td>
                <td className="px-2 py-1.5 border border-gray-200 text-center text-teal-600 font-bold">{t.assignee_abbrev || '—'}</td>
                <td className="px-2 py-1.5 border border-gray-200 text-gray-500">
                  {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'}
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
                      {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'}
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
            工作记录 <span className="text-gray-400 font-normal">({records.length})</span>
          </h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-24">案件</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                {showOperator && <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">操作人</th>}
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
            工时记录 <span className="text-gray-400 font-normal">({timeLogs.length})</span>
          </h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-24">案件</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-20">时段</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-16">时长</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">内容</th>
                {showOperator && <th className="text-left px-2 py-1.5 border border-gray-200 font-medium w-14">操作人</th>}
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
            已完成待办 <span className="text-gray-400 font-normal">({todos.length})</span>
          </h4>
          {renderTodos()}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ profile, groupId, groupName, subdomain }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { signOut } = useClerk()

  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  const isAdmin    = ['first_admin', 'second_admin'].includes(profile?.role || '')
  const todayStr   = new Date().toISOString().split('T')[0]

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
  const [remSaving,    setRemSaving]    = useState(false)

  const [selectedRem, setSelectedRem] = useState<Reminder | null>(null)
  const [detailMode,  setDetailMode]  = useState<'view' | 'edit'>('view')
  const [editType,      setEditType]      = useState('others')
  const [editStartDate, setEditStartDate] = useState(todayStr)
  const [editEndDate_,  setEditEndDate_]  = useState(todayStr)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime,   setEditEndTime]   = useState('')
  const [editContent,   setEditContent]   = useState('')
  const [editAssigned,  setEditAssigned]  = useState('')
  const [editSaving,    setEditSaving]    = useState(false)

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
  }, [groupId])

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
    if (!remStartDate || !remEndDate_ || !remContent.trim()) { alert('请填写必填项'); return }
    if (remEndDate_ < remStartDate) { alert('结束日期不能早于开始日期'); return }
    if (remEndTime && remStartTime && remEndTime <= remStartTime) { alert('结束时间必须晚于开始时间'); return }
    setRemSaving(true)
    const { error } = await supabase.from('reminders').insert({
      due_date: remStartDate, start_date: remStartDate, end_date: remEndDate_,
      content: encField(remContent.trim(), groupKey) ?? remContent.trim(), type: remType,
      start_time: remStartTime || null, end_time: remEndTime || null,
      assigned_to_name: remAssigned || null,
      group_id: groupId,
      created_by: profile!.id,
    })
    if (error) { alert('保存失败：' + error.message) }
    else { setShowAddRem(false); resetAddForm(); await loadReminders() }
    setRemSaving(false)
  }

  function resetAddForm() {
    setRemContent(''); setRemStartDate(todayStr); setRemEndDate_(todayStr)
    setRemType('others'); setRemStartTime(''); setRemEndTime(''); setRemAssigned('')
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
    setDetailMode('edit')
  }

  async function saveEditRem() {
    if (!editStartDate || !editEndDate_ || !editContent.trim()) { alert('请填写必填项'); return }
    if (editEndDate_ < editStartDate) { alert('结束日期不能早于开始日期'); return }
    if (editEndTime && editStartTime && editEndTime <= editStartTime) { alert('结束时间必须晚于开始时间'); return }
    setEditSaving(true)
    const { error } = await supabase.from('reminders').update({
      due_date: editStartDate, start_date: editStartDate, end_date: editEndDate_,
      content: encField(editContent.trim(), groupKey) ?? editContent.trim(), type: editType,
      start_time: editStartTime || null, end_time: editEndTime || null,
      assigned_to_name: editAssigned || null,
    }).eq('id', selectedRem!.id).eq('group_id', groupId)
    setEditSaving(false)
    if (error) { alert('保存失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function softDeleteReminder(id: string) {
    if (!confirm('确认删除该日程？删除后仍可在历史记录中查看。')) return
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', profile!.id).single()
    const { error } = await supabase.from('reminders').update({
      deleted: true, deleted_by: profile!.id,
      deleted_by_name: prof?.name || '未知', deleted_at: new Date().toISOString(),
    }).eq('id', id).eq('group_id', groupId)
    if (error) { alert('删除失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function restoreReminder(id: string) {
    const { error } = await supabase.from('reminders').update({
      deleted: false, deleted_by: null, deleted_by_name: null, deleted_at: null,
    }).eq('id', id).eq('group_id', groupId)
    if (error) { alert('恢复失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function hardDeleteReminder(id: string) {
    if (!confirm('确认永久删除？此操作不可恢复。')) return
    const { error } = await supabase.from('reminders').delete().eq('id', id).eq('group_id', groupId)
    if (error) { alert('删除失败：' + error.message); return }
    closeDetailRem(); await loadReminders()
  }

  async function loadPersonalStats() {
    if (!currentUserId) return
    setPersonalLoading(true); setPersonalQueried(true)
    const startDay = personalMode === 'range' ? personalRangeStart : personalDate
    const endDay   = personalMode === 'range' ? personalRangeEnd   : personalDate
    if (endDay < startDay) { alert('结束日期不能早于开始日期'); setPersonalLoading(false); setPersonalQueried(false); return }
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
    if (endDay < startDay) { alert('结束日期不能早于开始日期'); setGroupLoading(false); setGroupQueried(false); return }
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
          不指定
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
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期 <span className="text-red-500">*</span></label>
            <input type="date" value={startDate}
              onChange={e => { onStartDate(e.target.value); if (endDate < e.target.value) onEndDate(e.target.value) }}
              className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期 <span className="text-red-500">*</span></label>
            <input type="date" value={endDate} min={startDate} onChange={e => onEndDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
            <input type="time" value={startTime} onChange={e => onStartTime(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
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
    return (
      <button onClick={() => openDetailRem(r)}
        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border transition-all ${cls}`}>
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
            {variant === 'upcoming' && r.assigned_to_name && (
              <span className="text-[10px] text-indigo-500 font-medium">@{r.assigned_to_name}</span>
            )}
            {variant === 'upcoming' && r.start_time && (
              <span className="text-[10px] text-gray-400">
                {fmtTime(r.start_time)}{r.end_time ? `–${fmtTime(r.end_time)}` : ''}
              </span>
            )}
            {variant === 'past'    && <span className="text-[10px] text-gray-400">已过期</span>}
            {variant === 'deleted' && r.deleted_by_name && (
              <span className="text-[10px] text-red-400">已删除 · {r.deleted_by_name}</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <>
      <div className="w-56 bg-white border-r border-gray-200 text-gray-900 flex flex-col h-full flex-shrink-0">

        {/* Logo + group name */}
        <div className="px-5 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0">Q</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{groupName}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                团队<span className="font-black text-amber-500" style={{fontVariantNumeric:'oldstyle-nums'}}>365</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 space-y-1 border-b border-gray-200 flex-shrink-0">
          {[
            { href: `/${subdomain}/projects`, label: '案件概览', icon: '📋' },
            ...(isAdmin ? [{ href: `/${subdomain}/admin`, label: '管理后台', icon: '⚙️' }] : []),
          ].map(item => (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left
                ${pathname === item.href ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <button
            onClick={() => { setShowPersonalStats(true); setPersonalRecords([]); setPersonalTimeLogs([]); setPersonalTodos([]); setPersonalQueried(false) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150 text-left">
            <span className="text-base">📊</span><span>个人工作统计</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => { setShowGroupStats(true); setGroupRecords([]); setGroupTimeLogs([]); setGroupTodos([]); setGroupQueried(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150 text-left">
              <span className="text-base">📊</span><span>团队工作统计</span>
            </button>
          )}

          {/* Switch group button — only if user belongs to multiple */}
          {myGroups.length > 1 && (
            <button
              onClick={() => setShowGroupPicker(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150 text-left">
              <span className="text-base">🔀</span><span>切换团队</span>
            </button>
          )}
        </nav>

        {/* 日程安排 */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">日程安排</span>
            <div className="flex items-center gap-1.5">
              {upcoming.length > 0 && (
                <button onClick={() => setShowAllRem(true)}
                  className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300 hover:border-teal-400 transition-colors">
                  查看全部
                </button>
              )}
              <button onClick={() => setShowAddRem(true)}
                className="text-xs text-gray-500 hover:text-teal-600 px-2 py-0.5 rounded border border-gray-300 hover:border-teal-400 transition-colors">
                + 添加
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            {visibleUpcoming.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="upcoming" />)}
            {hasMoreUpcoming && (
              <button onClick={() => setShowAllUpcoming(true)}
                className="w-full py-1.5 text-xs text-gray-500 hover:text-teal-600 border border-dashed border-gray-300 hover:border-teal-400 rounded-lg transition-colors">
                查看更多（还有 {upcoming.length - MAX_UPCOMING} 条）
              </button>
            )}
            {showAllUpcoming && upcoming.length > MAX_UPCOMING && (
              <button onClick={() => setShowAllUpcoming(false)}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg transition-colors">
                收起
              </button>
            )}
            {past.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已过期 {past.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {past.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="past" />)}
              </>
            )}
            {deletedRems.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">已删除 {deletedRems.length}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {deletedRems.map((r, i) => <ReminderRow key={r.id} r={r} index={i} variant="deleted" />)}
              </>
            )}
            {displayReminders.length === 0 && <p className="text-xs text-gray-400 text-center py-4">暂无日程</p>}
          </div>
        </div>

        {/* User info & logout */}
        <div className="px-3 py-4 border-t border-gray-200 flex-shrink-0">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-gray-900 truncate">{profile?.name || 'User'}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {profile?.role === 'first_admin' ? '一级管理员'
                : profile?.role === 'second_admin' ? '二级管理员'
                : '成员'}
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150">
            <span>🚪</span><span>退出登录</span>
          </button>
        </div>
      </div>

      {/* ══ Switch Group Modal ══════════════════════════════════ */}
      {showGroupPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">切换团队</h3>
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
                  {g.id === groupId && <span className="ml-2 text-xs font-normal text-teal-500">当前</span>}
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
              <h3 className="text-base font-semibold text-gray-900">添加日程</h3>
              <button onClick={() => { setShowAddRem(false); resetAddForm() }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型 <span className="text-red-500">*</span></label>
                <TypeGrid current={remType} onSet={setRemType} />
              </div>
              <DateTimeFields
                startDate={remStartDate} endDate={remEndDate_}
                startTime={remStartTime} endTime={remEndTime}
                onStartDate={setRemStartDate} onEndDate={setRemEndDate_}
                onStartTime={setRemStartTime} onEndTime={setRemEndTime}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">指定成员</label>
                <MemberSelector current={remAssigned} onSet={setRemAssigned} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容 <span className="text-red-500">*</span></label>
                <textarea value={remContent} onChange={e => setRemContent(e.target.value)}
                  placeholder="日程内容…" rows={3} className="input-field resize-none" autoFocus />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={() => { setShowAddRem(false); resetAddForm() }}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={saveReminder} disabled={remSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {remSaving ? '保存中…' : '保存'}
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
                {detailMode === 'edit' ? '修改日程' : '日程详情'}
              </h3>
              <button onClick={closeDetailRem} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {detailMode === 'view' ? (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {selectedRem.deleted ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                      <span className="text-xs text-red-500 font-semibold">已删除</span>
                      {selectedRem.deleted_by_name && <span className="text-xs text-red-400">· 操作人：{selectedRem.deleted_by_name}</span>}
                    </div>
                  ) : remEndDate(selectedRem) < todayStr ? (
                    <div className="px-3 py-1.5 bg-gray-100 rounded-lg">
                      <span className="text-xs text-gray-500 font-semibold">已过期</span>
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
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">关闭</button>
                  {!selectedRem.deleted && (
                    <button onClick={() => startEditRem(selectedRem)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">修改</button>
                  )}
                  {!selectedRem.deleted && (
                    <button onClick={() => softDeleteReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">删除</button>
                  )}
                  {selectedRem.deleted && (currentUserId === selectedRem.deleted_by || isAdmin) && (
                    <button onClick={() => restoreReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">恢复</button>
                  )}
                  {selectedRem.deleted && isAdmin && (
                    <button onClick={() => hardDeleteReminder(selectedRem.id)}
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors">永久删除</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">类型 <span className="text-red-500">*</span></label>
                    <TypeGrid current={editType} onSet={setEditType} />
                  </div>
                  <DateTimeFields
                    startDate={editStartDate} endDate={editEndDate_}
                    startTime={editStartTime} endTime={editEndTime}
                    onStartDate={setEditStartDate} onEndDate={setEditEndDate_}
                    onStartTime={setEditStartTime} onEndTime={setEditEndTime}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">指定成员</label>
                    <MemberSelector current={editAssigned} onSet={setEditAssigned} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">内容 <span className="text-red-500">*</span></label>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={3} className="input-field resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
                  <button onClick={() => setDetailMode('view')}
                    className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
                  <button onClick={saveEditRem} disabled={editSaving}
                    className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                    {editSaving ? '保存中…' : '保存'}
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
                <h3 className="text-base font-semibold text-gray-900">个人工作统计</h3>
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
                  单日
                </button>
                <button onClick={() => { setPersonalMode('range'); setPersonalQueried(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${personalMode === 'range'
                      ? 'bg-rose-400 text-white border-rose-400'
                      : 'bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100'}`}>
                  区间
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
                    <span className="text-sm text-gray-400">至</span>
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
                  {personalLoading ? '查询中…' : '确认'}
                </button>
                {personalQueried && !personalLoading && (
                  <span className="text-xs text-gray-400">共 {personalRecords.length + personalTimeLogs.length + personalTodos.length} 条</span>
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
              <h3 className="text-base font-semibold text-gray-900">全部待办日程 <span className="text-gray-400 font-normal text-sm">({upcoming.length})</span></h3>
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
              <h3 className="text-base font-semibold text-gray-900">团队工作统计</h3>
              <button onClick={() => setShowGroupStats(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-3">
              <div className="flex gap-2">
                <button onClick={() => { setGroupMode('single'); setGroupQueried(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${groupMode === 'single'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'text-gray-600 hover:bg-gray-100 border-gray-200'}`}>
                  单日
                </button>
                <button onClick={() => { setGroupMode('range'); setGroupQueried(false) }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${groupMode === 'range'
                      ? 'bg-rose-400 text-white border-rose-400'
                      : 'bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100'}`}>
                  区间
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
                    <span className="text-sm text-gray-400">至</span>
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
                  {groupLoading ? '查询中…' : '确认'}
                </button>
                {groupQueried && !groupLoading && (
                  <span className="text-xs text-gray-400">共 {groupRecords.length + groupTimeLogs.length + groupTodos.length} 条</span>
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
