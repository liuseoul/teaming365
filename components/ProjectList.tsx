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
  all:       '全部',
  active:    '进行中',
  pending:   '待处理',
  completed: '已完成',
  cancelled: '未签约',
  delayed:   '已终止',
  archived:  '已归档',
}

const STATUS_ORDER = ['all', 'active', 'pending', 'completed', 'cancelled', 'delayed', 'archived']

const ROW_COLORS = ['bg-white', 'bg-teal-50']

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
  criminal: '刑事', corporate: '公司商事', family: '婚姻家事',
  ip: '知识产权', real_estate: '房产', labor: '劳动',
  administrative: '行政', civil: '民事', other: '其他',
}

type StatsResult = { total: number; accepted: number; completed: number }
type SortMode = 'latest_activity' | 'created_at'

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

  // Generate/restore user's E2E keypair on first load (silent, background)
  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  const [filter,     setFilter]     = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [editProject, setEditProject] = useState<any | null>(null)
  const [form,        setForm]        = useState<EditForm>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)

  const [displayProjects, setDisplayProjects] = useState<any[]>(projects)

  // ── Project Stats (Task 4) ──────────────────────────────────
  const [showProjStats,   setShowProjStats]   = useState(false)
  const [statsStart,      setStatsStart]      = useState('')
  const [statsEnd,        setStatsEnd]        = useState('')
  const [statsResult,     setStatsResult]     = useState<StatsResult | null>(null)
  const [showStatsResult, setShowStatsResult] = useState(false)

  // ── Sort Modal (Task 8) ─────────────────────────────────────
  const [showSortModal,   setShowSortModal]   = useState(false)
  const [sortMode,        setSortMode]        = useState<SortMode>('latest_activity')
  const [pendingSortMode, setPendingSortMode] = useState<SortMode>('latest_activity')

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
      collaboration_parties: (project.collaboration_parties as string[] | null)?.join('，') || '',
      status:                project.status || 'active',
    })
  }

  function closeEdit() { setEditProject(null); setForm(EMPTY_FORM) }

  function setField(key: keyof EditForm, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function saveEdit() {
    if (!form.name.trim()) { alert('案件名称不能为空'); return }
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
    if (error) { alert('保存失败：' + error.message); return }
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

  // Task 6 + Task 8: sort respects sortMode; delayed always at end
  const sorted = (list: any[]) => {
    const nonDelayed = list.filter((p: any) => p.status !== 'delayed')
    const delayed    = list.filter((p: any) => p.status === 'delayed')

    if (sortMode === 'created_at') {
      const byCt = (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return [...nonDelayed.sort(byCt), ...delayed.sort(byCt)]
    }

    // 'latest_activity' (default)
    const byActivity = (a: any, b: any) => {
      const ta = getMaxActivityTs(a), tb = getMaxActivityTs(b)
      if (ta !== tb) return tb - ta
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return [...nonDelayed.sort(byActivity), ...delayed.sort(byActivity)]
  }

  // ── Project Stats helpers (Task 4) ──────────────────────────
  function computeStats() {
    if (!statsStart || !statsEnd) { alert('请填写开始日期和结束日期'); return }
    if (statsEnd < statsStart) { alert('结束日期不能早于开始日期'); return }
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
    { value: 'active',    label: '进行中' },
    { value: 'pending',   label: '待处理' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '未签约' },
    { value: 'delayed',   label: '已终止' },
    { value: 'archived',  label: '已归档' },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} groupId={groupId} groupName={groupName} subdomain={subdomain} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">案件概览</h1>
          {isAdmin && (
            <button
              onClick={() => router.push(`/${subdomain}/admin`)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white
                         text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150"
            >
              <span className="text-base leading-none">+</span>
              <span>新建案件</span>
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap">
          {STATUS_ORDER.map(key => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150
                ${filter === key ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
              {STATUS_LABELS[key]}
              {key !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  {projects.filter((p: any) => p.status === key).length}
                </span>
              )}
            </button>
          ))}

          {/* Task 4: 项目统计 button */}
          <button
            onClick={() => { setStatsStart(''); setStatsEnd(''); setShowProjStats(true) }}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-teal-500 text-white
                       hover:bg-teal-600 transition-colors duration-150"
          >
            案件统计
          </button>

          {/* Task 8: 案件排序 button */}
          <button
            onClick={() => { setPendingSortMode(sortMode); setShowSortModal(true) }}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-500 text-white
                       hover:bg-indigo-600 transition-colors duration-150"
          >
            案件排序
          </button>

          <span className="ml-auto text-xs text-gray-400">共 {projects.length} 个案件</span>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📂</div>
              <div className="text-sm">暂无案件</div>
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
                        修改
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3 truncate">
                    <span className={isCancelled ? 'line-through' : ''}>
                      委托方：{project.client || '—'}
                    </span>
                    {project.agreement_party && (
                      <span className="text-xs text-indigo-500 font-medium">{project.agreement_party}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">📝</span>
                    {recordCount} 条记录
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">⏱</span>
                    {hours} 小时
                  </span>
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
                    <span className="text-xs text-gray-300 w-28 text-right">暂无记录</span>
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

      {/* ══ Edit Project Modal ══════════════════════════════════ */}
      {editProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">修改案件信息</h3>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  案件名称 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.name} onChange={e => setField('name', e.target.value)}
                  className="input-field" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">委托方</label>
                <input type="text" value={form.client} onChange={e => setField('client', e.target.value)}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">案件类型</label>
                <select value={form.matter_type} onChange={e => setField('matter_type', e.target.value)} className="input-field">
                  <option value="">请选择（可选）</option>
                  {Object.entries(MATTER_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">协议方</label>
                <input type="text" value={form.agreement_party}
                  onChange={e => setField('agreement_party', e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费币种</label>
                  <input type="text" value={form.service_fee_currency}
                    onChange={e => setField('service_fee_currency', e.target.value)}
                    placeholder="CNY / USD / KRW…" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费金额</label>
                  <input type="number" value={form.service_fee_amount}
                    onChange={e => setField('service_fee_amount', e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">协作方</label>
                <input type="text" value={form.collaboration_parties}
                  onChange={e => setField('collaboration_parties', e.target.value)}
                  placeholder="多个协作方用逗号分隔" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                  rows={3} className="input-field resize-none" />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={closeEdit}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 项目统计 — Step 1: Date range modal (Task 4) ════════ */}
      {showProjStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">案件统计</h3>
              <button onClick={() => setShowProjStats(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  开始日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={statsStart}
                  onChange={e => setStatsStart(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  结束日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={statsEnd}
                  onChange={e => setStatsEnd(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowProjStats(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={computeStats}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg transition-colors">
                统计
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 项目统计 — Step 2: Results modal (Task 4) ══════════ */}
      {showStatsResult && statsResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">统计结果</h3>
              <button onClick={() => setShowStatsResult(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              统计区间：{statsStart} ~ {statsEnd}
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">新立案件数</span>
                <span className="text-lg font-bold text-teal-600">{statsResult.total}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">已承接案件数</span>
                <span className="text-lg font-bold text-teal-600">{statsResult.accepted}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">已完成案件数</span>
                <span className="text-lg font-bold text-teal-600">{statsResult.completed}</span>
              </div>
            </div>
            <button
              onClick={() => setShowStatsResult(false)}
              className="w-full mt-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ══ 项目排序 modal (Task 8) ══════════════════════════════ */}
      {showSortModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">案件排序</h3>
              <button onClick={() => setShowSortModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3">
              {([
                { value: 'latest_activity', label: '按最新操作时间' },
                { value: 'created_at',      label: '按创建时间' },
              ] as { value: SortMode; label: string }[]).map(opt => (
                <label key={opt.value}
                  className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="sortMode"
                    value={opt.value}
                    checked={pendingSortMode === opt.value}
                    onChange={() => setPendingSortMode(opt.value)}
                    className="accent-teal-600"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSortModal(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button
                onClick={() => { setSortMode(pendingSortMode); setShowSortModal(false) }}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
