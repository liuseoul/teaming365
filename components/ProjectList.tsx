'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import ProjectDetailPanel from './ProjectDetailPanel'
import TodoPanel from './TodoPanel'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { encField, decField } from '@/lib/e2e'

const STATUS_LABELS: Record<string, string> = {
  all:       'All',
  active:    'Active',
  pending:   'Pending',
  completed: 'Closed',
  cancelled: 'Declined',
  delayed:   'Terminated',
  archived:  'Archived',
}

const STATUS_ORDER = ['all', 'active', 'pending', 'completed', 'cancelled', 'delayed', 'archived']

const ROW_COLORS = ['bg-white', 'bg-gray-50']

function calcHours(logs: Array<{ started_at: string; finished_at: string | null; deleted?: boolean }>) {
  return logs
    .reduce((sum, log) => {
      if (!log.finished_at || log.deleted) return sum
      return sum + (new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 3600000
    }, 0)
    .toFixed(1)
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getLatestActivity(project: any): { label: string; operator: string } | null {
  const activities: { ts: number; label: string; operator: string }[] = []
  for (const r of project.work_records || []) {
    if (r.deleted) continue
    activities.push({ ts: new Date(r.created_at).getTime(), label: formatShortDate(r.created_at), operator: r.profiles?.name || '' })
  }
  for (const l of project.time_logs || []) {
    if (l.deleted) continue
    activities.push({ ts: new Date(l.started_at).getTime(), label: formatShortDate(l.started_at), operator: l.profiles?.name || '' })
  }
  if (activities.length === 0) return null
  activities.sort((a, b) => b.ts - a.ts)
  return { label: activities[0].label, operator: activities[0].operator }
}

type EditForm = {
  name: string
  client: string
  description: string
  matter_type: string
  agreement_party: string
  service_fee_currency: string
  service_fee_amount: string
  collaboration_parties: string
  status: string
}

const EMPTY_FORM: EditForm = {
  name: '', client: '', description: '', matter_type: '',
  agreement_party: '', service_fee_currency: '', service_fee_amount: '',
  collaboration_parties: '', status: 'active',
}

const MATTER_TYPE_LABELS: Record<string, string> = {
  criminal: 'Criminal', corporate: 'Corporate', family: 'Family',
  ip: 'IP', real_estate: 'Real Estate', labor: 'Labor',
  administrative: 'Administrative', civil: 'Civil', other: 'Other',
}

type StatsResult = { total: number; accepted: number; completed: number }
type SortMode = 'latest_activity' | 'created_at'

// ── Weekly summary types ────────────────────────────────────
type WeeklyMatterSummary = {
  matterId: string
  matterName: string
  billableH: number
  nonBillableH: number
  recordCount: number
}
type WeeklySummaryData = {
  billableH: number
  nonBillableH: number
  recordCount: number
  matters: WeeklyMatterSummary[]
}

export default function ProjectList({
  projects, profile, groupId, groupName, subdomain,
}: {
  projects: any[]
  profile: any
  groupId: string
  groupName: string
  subdomain: string
}) {
  const supabase   = createClient()
  const router     = useRouter()
  const isAdmin    = ['first_admin', 'second_admin'].includes(profile?.role || '')

  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  const [filter,     setFilter]     = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [editProject, setEditProject] = useState<any | null>(null)
  const [form,        setForm]        = useState<EditForm>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)

  const [displayProjects, setDisplayProjects] = useState<any[]>(projects)

  // ── Project Stats ────────────────────────────────────────
  const [showProjStats,   setShowProjStats]   = useState(false)
  const [statsStart,      setStatsStart]      = useState('')
  const [statsEnd,        setStatsEnd]        = useState('')
  const [statsResult,     setStatsResult]     = useState<StatsResult | null>(null)
  const [showStatsResult, setShowStatsResult] = useState(false)

  // ── Sort Modal ───────────────────────────────────────────
  const [showSortModal,   setShowSortModal]   = useState(false)
  const [sortMode,        setSortMode]        = useState<SortMode>('latest_activity')
  const [pendingSortMode, setPendingSortMode] = useState<SortMode>('latest_activity')

  // ── Due Today strip ──────────────────────────────────────
  const [todayTodos,     setTodayTodos]     = useState<any[]>([])
  const [todayReminders, setTodayReminders] = useState<any[]>([])
  const [showTodayModal, setShowTodayModal] = useState(false)

  // ── Weekly Summary ───────────────────────────────────────
  const [showWeeklySummary,  setShowWeeklySummary]  = useState(false)
  const [weeklyData,         setWeeklyData]         = useState<WeeklySummaryData | null>(null)
  const [weeklyLoading,      setWeeklyLoading]      = useState(false)
  const [weeklyMonday,       setWeeklyMonday]        = useState('')
  const [weeklySunday,       setWeeklySunday]        = useState('')

  useEffect(() => {
    if (!groupKey) return
    setDisplayProjects(projects.map((p: any) => ({
      ...p,
      name:        decField(p.name, groupKey),
      client:      decField(p.client, groupKey),
      description: decField(p.description, groupKey),
      agreement_party: decField(p.agreement_party, groupKey),
      collaboration_parties: Array.isArray(p.collaboration_parties)
        ? p.collaboration_parties.map((c: string) => decField(c, groupKey))
        : p.collaboration_parties,
    })))
  }, [groupKey, projects])

  // Fetch today's todos and reminders on mount
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    ;(async () => {
      const [{ data: todosData }, { data: remsData }] = await Promise.all([
        supabase.from('todos')
          .select('id, content, due_date, assignee_abbrev')
          .eq('group_id', groupId)
          .eq('deleted', false)
          .eq('completed', false)
          .eq('due_date', today),
        supabase.from('reminders')
          .select('id, content, start_date, due_date, type')
          .eq('group_id', groupId)
          .eq('deleted', false)
          .or(`start_date.eq.${today},due_date.eq.${today}`),
      ])
      setTodayTodos(todosData || [])
      setTodayReminders(remsData || [])
    })()
  }, [groupId])

  // Fetch weekly summary when modal opens
  useEffect(() => {
    if (!showWeeklySummary) return
    const now = new Date()
    const dow = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - dow + 1)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const monStr = monday.toISOString().slice(0, 10)
    const sunStr = sunday.toISOString().slice(0, 10)
    setWeeklyMonday(monStr)
    setWeeklySunday(sunStr)

    setWeeklyLoading(true)
    ;(async () => {
      const s = `${monStr}T00:00:00.000Z`
      const e = `${sunStr}T23:59:59.999Z`
      const [{ data: logsData }, { data: recsData }] = await Promise.all([
        supabase.from('time_logs')
          .select('id, started_at, finished_at, billable, project_id, projects(id, name)')
          .eq('group_id', groupId)
          .eq('deleted', false)
          .gte('started_at', s)
          .lte('started_at', e),
        supabase.from('work_records')
          .select('id, project_id, projects(id, name)')
          .eq('group_id', groupId)
          .eq('deleted', false)
          .gte('created_at', s)
          .lte('created_at', e),
      ])

      const logs = logsData || []
      const recs = recsData || []

      let billableH = 0, nonBillableH = 0
      const matterMap: Record<string, WeeklyMatterSummary> = {}

      for (const l of logs) {
        if (!l.finished_at) continue
        const mins = (new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 3600000
        const pid = l.project_id || 'none'
        const pname = (l.projects as any)?.name ? decField((l.projects as any).name, groupKey) || (l.projects as any).name : '(no matter)'
        if (!matterMap[pid]) matterMap[pid] = { matterId: pid, matterName: pname, billableH: 0, nonBillableH: 0, recordCount: 0 }
        if (l.billable !== false) {
          billableH += mins
          matterMap[pid].billableH += mins
        } else {
          nonBillableH += mins
          matterMap[pid].nonBillableH += mins
        }
      }

      for (const r of recs) {
        const pid = r.project_id || 'none'
        const pname = (r.projects as any)?.name ? decField((r.projects as any).name, groupKey) || (r.projects as any).name : '(no matter)'
        if (!matterMap[pid]) matterMap[pid] = { matterId: pid, matterName: pname, billableH: 0, nonBillableH: 0, recordCount: 0 }
        matterMap[pid].recordCount += 1
      }

      setWeeklyData({
        billableH,
        nonBillableH,
        recordCount: recs.length,
        matters: Object.values(matterMap),
      })
      setWeeklyLoading(false)
    })()
  }, [showWeeklySummary, groupId, groupKey])

  function openEdit(e: React.MouseEvent, project: any) {
    e.stopPropagation()
    setEditProject(project)
    setForm({
      name:                  project.name || '',
      client:                project.client || '',
      description:           project.description || '',
      matter_type:           project.matter_type || '',
      agreement_party:       project.agreement_party || '',
      service_fee_currency:  project.service_fee_currency || '',
      service_fee_amount:    project.service_fee_amount != null ? String(project.service_fee_amount) : '',
      collaboration_parties: (project.collaboration_parties as string[] | null)?.join(', ') || '',
      status:                project.status || 'active',
    })
  }

  function closeEdit() { setEditProject(null); setForm(EMPTY_FORM) }

  function setField(key: keyof EditForm, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function saveEdit() {
    if (!form.name.trim()) { alert('Matter name is required'); return }
    setSaving(true)
    const parties = form.collaboration_parties
      ? form.collaboration_parties.split(/[,，]/).map(s => s.trim()).filter(Boolean)
      : []
    const { error } = await supabase.from('projects').update({
      name:                  encField(form.name.trim(), groupKey) ?? form.name.trim(),
      client:                encField(form.client.trim() || null, groupKey),
      description:           encField(form.description.trim() || null, groupKey),
      matter_type:           form.matter_type || null,
      agreement_party:       encField(form.agreement_party.trim() || null, groupKey),
      service_fee_currency:  form.service_fee_currency.trim() || null,
      service_fee_amount:    form.service_fee_amount ? parseFloat(form.service_fee_amount) : null,
      collaboration_parties: parties.map(p => encField(p, groupKey) ?? p),
      status:                form.status,
    }).eq('id', editProject.id).eq('group_id', groupId)
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    closeEdit()
    router.refresh()
  }

  function getMaxActivityTs(p: any): number {
    let maxTs = 0
    for (const r of p.work_records || []) {
      if (r.deleted) continue
      const ts = new Date(r.created_at).getTime()
      if (ts > maxTs) maxTs = ts
    }
    for (const l of p.time_logs || []) {
      if (l.deleted) continue
      const ts = new Date(l.started_at).getTime()
      if (ts > maxTs) maxTs = ts
    }
    return maxTs
  }

  const sorted = (list: any[]) => {
    const nonDelayed = list.filter((p: any) => p.status !== 'delayed')
    const delayed    = list.filter((p: any) => p.status === 'delayed')

    if (sortMode === 'created_at') {
      const byCt = (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return [...nonDelayed.sort(byCt), ...delayed.sort(byCt)]
    }

    const byActivity = (a: any, b: any) => {
      const ta = getMaxActivityTs(a), tb = getMaxActivityTs(b)
      if (ta !== tb) return tb - ta
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return [...nonDelayed.sort(byActivity), ...delayed.sort(byActivity)]
  }

  function computeStats() {
    if (!statsStart || !statsEnd) { alert('Please fill in start and end dates'); return }
    if (statsEnd < statsStart) { alert('End date cannot be before start date'); return }
    const from = new Date(statsStart).getTime()
    const to   = new Date(statsEnd + 'T23:59:59').getTime()
    const inRange = displayProjects.filter((p: any) => {
      const t = new Date(p.created_at).getTime()
      return t >= from && t <= to
    })
    const total     = inRange.length
    const accepted  = inRange.filter((p: any) => p.status !== 'cancelled' && p.status !== 'delayed').length
    const completed = inRange.filter((p: any) => p.status === 'completed').length
    setStatsResult({ total, accepted, completed })
    setShowProjStats(false)
    setShowStatsResult(true)
  }

  const filtered        = sorted(filter === 'all' ? displayProjects : displayProjects.filter((p: any) => p.status === filter))
  const selectedProject = displayProjects.find((p: any) => p.id === selectedId) || null

  const STATUS_EDIT = [
    { value: 'active',    label: 'Active' },
    { value: 'pending',   label: 'Pending' },
    { value: 'completed', label: 'Closed' },
    { value: 'cancelled', label: 'Declined' },
    { value: 'delayed',   label: 'Terminated' },
    { value: 'archived',  label: 'Archived' },
  ]

  const todayCount = todayTodos.length + todayReminders.length

  return (
    <Sidebar profile={profile} groupId={groupId} groupName={groupName} subdomain={subdomain}>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ── Unified toolbar ── */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            {/* Status filter pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_ORDER.map(key => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border
                    ${filter === key
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'text-gray-600 border-gray-200 hover:border-slate-400 hover:text-slate-800'}`}>
                  {STATUS_LABELS[key]}
                  {key !== 'all' && (
                    <span className="ml-1 opacity-60">{projects.filter((p: any) => p.status === key).length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

            {/* Action buttons */}
            <button onClick={() => { setStatsStart(''); setStatsEnd(''); setShowProjStats(true) }}
              className="px-3 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 hover:border-slate-400 hover:text-slate-800 transition-colors">
              Stats
            </button>
            <button onClick={() => { setWeeklyData(null); setShowWeeklySummary(true) }}
              className="px-3 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 hover:border-slate-400 hover:text-slate-800 transition-colors">
              This Week
            </button>
            <button onClick={() => { setPendingSortMode(sortMode); setShowSortModal(true) }}
              className="px-3 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 hover:border-slate-400 hover:text-slate-800 transition-colors">
              Sort
            </button>

            <span className="text-xs text-gray-400 ml-auto">{projects.length}</span>

            {isAdmin && (
              <button onClick={() => router.push(`/${subdomain}/admin`)}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors">
                <span>+</span><span>New matter</span>
              </button>
            )}
          </div>

          {/* Due-today strip */}
          {todayCount > 0 && (
            <button onClick={() => setShowTodayModal(true)}
              className="w-full text-xs text-amber-700 bg-amber-50 border-t border-amber-200 px-4 py-1.5 text-left hover:bg-amber-100 transition-colors">
              Today &middot; {todayTodos.length > 0 && `${todayTodos.length} todo${todayTodos.length > 1 ? 's' : ''} due`}
              {todayTodos.length > 0 && todayReminders.length > 0 && ' · '}
              {todayReminders.length > 0 && `${todayReminders.length} event${todayReminders.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>

        {/* Matter list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-sm">No matters</div>
            </div>
          )}

          {filtered.map((project: any, index: number) => {
            const isCancelled = project.status === 'delayed'
            const recordCount = (project.work_records || []).filter((r: any) => !r.deleted).length
            const hours       = calcHours(project.time_logs || [])
            const isSelected  = selectedId === project.id
            const rowBg       = ROW_COLORS[index % 2]
            const latestAct   = getLatestActivity(project)

            return (
              <div
                key={project.id}
                className={`project-row ${isSelected ? 'selected' : rowBg} ${isCancelled ? 'opacity-50' : ''}`}
                onClick={() => setSelectedId(isSelected ? null : project.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-gray-900 truncate ${isCancelled ? 'line-through' : ''}`}>
                      {project.name}
                    </span>
                    {project.matter_type && MATTER_TYPE_LABELS[project.matter_type] && (
                      <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {MATTER_TYPE_LABELS[project.matter_type]}
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={e => openEdit(e, project)}
                        className="flex-shrink-0 text-[11px] text-gray-400 hover:text-teal-600
                                   border border-gray-200 hover:border-teal-400 rounded px-1.5 py-0.5
                                   transition-colors leading-none"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3 truncate">
                    <span className={isCancelled ? 'line-through' : ''}>
                      Client: {project.client || '—'}
                    </span>
                    {project.agreement_party && (
                      <span className="text-xs text-indigo-500 font-medium">{project.agreement_party}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                  <span>{recordCount} records</span>
                  <span>{hours} h</span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`status-tag st-${project.status}`}>
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                  {latestAct ? (
                    <div className="text-right w-28">
                      <div className="text-xs text-gray-500">{latestAct.label}</div>
                      <div className="text-[10px] text-gray-400">{latestAct.operator}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 w-28 text-right">No activity</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          profile={profile}
          groupId={groupId}
          onClose={() => setSelectedId(null)}
        />
      )}

      <TodoPanel profile={profile} groupId={groupId} />

      {/* ══ Edit Matter Modal ═══════════════════════════════════ */}
      {editProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Edit matter</h3>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Matter name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.name} onChange={e => setField('name', e.target.value)}
                  className="input-field" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <input type="text" value={form.client} onChange={e => setField('client', e.target.value)}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matter type</label>
                <select value={form.matter_type} onChange={e => setField('matter_type', e.target.value)} className="input-field">
                  <option value="">Select (optional)</option>
                  {Object.entries(MATTER_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Counterparty</label>
                <input type="text" value={form.agreement_party}
                  onChange={e => setField('agreement_party', e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee currency</label>
                  <input type="text" value={form.service_fee_currency}
                    onChange={e => setField('service_fee_currency', e.target.value)}
                    placeholder="CNY / USD / KRW…" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee amount</label>
                  <input type="number" value={form.service_fee_amount}
                    onChange={e => setField('service_fee_amount', e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Co-counsel</label>
                <input type="text" value={form.collaboration_parties}
                  onChange={e => setField('collaboration_parties', e.target.value)}
                  placeholder="Separate multiple parties with commas" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_EDIT.map(s => (
                    <button key={s.value} type="button" onClick={() => setField('status', s.value)}
                      className={`py-1.5 px-3 text-sm rounded-lg border transition-colors text-left
                        ${form.status === s.value
                          ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                  rows={3} className="input-field resize-none" />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={closeEdit}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Stats — date range modal ═════════════════════════════ */}
      {showProjStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">Matter stats</h3>
              <button onClick={() => setShowProjStats(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start date <span className="text-red-500">*</span>
                </label>
                <input type="date" value={statsStart} onChange={e => setStatsStart(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End date <span className="text-red-500">*</span>
                </label>
                <input type="date" value={statsEnd} onChange={e => setStatsEnd(e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProjStats(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={computeStats}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                View stats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Stats — results modal ═══════════════════════════════ */}
      {showStatsResult && statsResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">Stats result</h3>
              <button onClick={() => setShowStatsResult(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{statsStart} – {statsEnd}</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Matters opened</span>
                <span className="text-lg font-bold text-teal-600">{statsResult.total}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Matters accepted</span>
                <span className="text-lg font-bold text-teal-600">{statsResult.accepted}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Matters closed</span>
                <span className="text-lg font-bold text-teal-600">{statsResult.completed}</span>
              </div>
            </div>
            <button onClick={() => setShowStatsResult(false)}
              className="w-full mt-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ══ Sort modal ══════════════════════════════════════════ */}
      {showSortModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-xs p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">Sort matters</h3>
              <button onClick={() => setShowSortModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3">
              {([
                { value: 'latest_activity', label: 'By latest activity' },
                { value: 'created_at',      label: 'By creation date' },
              ] as { value: SortMode; label: string }[]).map(opt => (
                <label key={opt.value}
                  className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <input type="radio" name="sortMode" value={opt.value}
                    checked={pendingSortMode === opt.value}
                    onChange={() => setPendingSortMode(opt.value)}
                    className="accent-teal-600" />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSortModal(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => { setSortMode(pendingSortMode); setShowSortModal(false) }}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Today modal ═════════════════════════════════════════ */}
      {showTodayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Today</h3>
              <button onClick={() => setShowTodayModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {todayTodos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Todos due today</p>
                  <div className="space-y-1">
                    {todayTodos.map(t => (
                      <div key={t.id} className="text-sm text-gray-800 px-2 py-1.5 rounded bg-amber-50 border border-amber-100">
                        {t.content}
                        {t.assignee_abbrev && <span className="ml-2 text-[10px] font-bold text-teal-600">{t.assignee_abbrev}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {todayReminders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Events today</p>
                  <div className="space-y-1">
                    {todayReminders.map(r => (
                      <div key={r.id} className="text-sm text-gray-800 px-2 py-1.5 rounded bg-teal-50 border border-teal-100">
                        {r.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Weekly Summary modal ════════════════════════════════ */}
      {showWeeklySummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">This Week</h3>
                {weeklyMonday && <p className="text-xs text-gray-400 mt-0.5">{weeklyMonday} – {weeklySunday}</p>}
              </div>
              <button onClick={() => setShowWeeklySummary(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {weeklyLoading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}
              {!weeklyLoading && weeklyData && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-teal-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-teal-700">{weeklyData.billableH.toFixed(1)}h</div>
                      <div className="text-xs text-teal-600 mt-0.5">Billable</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-600">{weeklyData.nonBillableH.toFixed(1)}h</div>
                      <div className="text-xs text-gray-500 mt-0.5">Non-billable</div>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-indigo-700">{weeklyData.recordCount}</div>
                      <div className="text-xs text-indigo-600 mt-0.5">Work records</div>
                    </div>
                  </div>

                  {weeklyData.matters.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Per matter</h4>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500">
                            <th className="text-left px-2 py-1.5 border border-gray-200 font-medium">Matter</th>
                            <th className="text-right px-2 py-1.5 border border-gray-200 font-medium">Billable</th>
                            <th className="text-right px-2 py-1.5 border border-gray-200 font-medium">Non-billable</th>
                            <th className="text-right px-2 py-1.5 border border-gray-200 font-medium">Records</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyData.matters.map(m => (
                            <tr key={m.matterId} className="hover:bg-gray-50">
                              <td className="px-2 py-1.5 border border-gray-200 text-gray-800">{m.matterName}</td>
                              <td className="px-2 py-1.5 border border-gray-200 text-teal-600 font-semibold text-right">{m.billableH.toFixed(1)}h</td>
                              <td className="px-2 py-1.5 border border-gray-200 text-gray-500 text-right">{m.nonBillableH.toFixed(1)}h</td>
                              <td className="px-2 py-1.5 border border-gray-200 text-gray-600 text-right">{m.recordCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  )
}
