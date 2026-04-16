'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { encField, decField } from '@/lib/e2e'

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  delayed: '已取消',
  completed: '已完成',
  cancelled: '未启动',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

function calcTotal(start: string, end: string): string {
  if (!start || !end) return '—'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const totalMin = (eh * 60 + em) - (sh * 60 + sm)
  if (totalMin <= 0) return '—'
  return `${totalMin} 分钟`
}

function durMinutes(started: string, finished: string | null): string {
  if (!finished) return '—'
  const mins = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 60000)
  if (mins <= 0) return '—'
  return `${mins} 分钟`
}

function localDatetime(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi]    = timeStr.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi, 0).toISOString()
}

type ProjectEditForm = {
  name: string
  client: string
  description: string
  status: string
  agreement_party: string
  service_fee_currency: string
  service_fee_amount: string
  collaboration_parties: string
}

const STATUS_EDIT_OPTIONS = [
  { value: 'active',    label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '未启动' },
  { value: 'delayed',   label: '已取消' },
]

export default function ProjectDetailPanel({
  project, profile, groupId, onClose,
}: {
  project: any
  profile: any
  groupId: string
  onClose: () => void
}) {
  const supabase = createClient()
  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  // ── Edit project state (Task 5) ───────────────────────────
  const [showEditProject, setShowEditProject] = useState(false)
  const [editForm,        setEditForm]        = useState<ProjectEditForm>({
    name: '', client: '', description: '', status: 'active',
    agreement_party: '', service_fee_currency: '', service_fee_amount: '',
    collaboration_parties: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  function openEditProject() {
    setEditForm({
      name:                  decField(project.name, groupKey) ?? project.name ?? '',
      client:                decField(project.client, groupKey) ?? project.client ?? '',
      description:           decField(project.description, groupKey) ?? project.description ?? '',
      status:                project.status || 'active',
      agreement_party:       decField(project.agreement_party, groupKey) ?? project.agreement_party ?? '',
      service_fee_currency:  project.service_fee_currency ?? '',
      service_fee_amount:    project.service_fee_amount != null ? String(project.service_fee_amount) : '',
      collaboration_parties: Array.isArray(project.collaboration_parties)
        ? project.collaboration_parties.map((c: string) => decField(c, groupKey) ?? c).join('，')
        : '',
    })
    setShowEditProject(true)
  }

  async function saveEditProject() {
    if (!editForm.name.trim()) { alert('项目名称不能为空'); return }
    if (!editForm.client.trim()) { alert('委托方不能为空'); return }
    setEditSaving(true)
    const parties = editForm.collaboration_parties
      ? editForm.collaboration_parties.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
      : []
    const { error } = await supabase.from('projects').update({
      name:                  encField(editForm.name.trim(), groupKey) ?? editForm.name.trim(),
      client:                encField(editForm.client.trim(), groupKey) ?? editForm.client.trim(),
      description:           encField(editForm.description.trim() || null, groupKey),
      status:                editForm.status,
      agreement_party:       encField(editForm.agreement_party.trim() || null, groupKey),
      service_fee_currency:  editForm.service_fee_currency.trim() || null,
      service_fee_amount:    editForm.service_fee_amount ? parseFloat(editForm.service_fee_amount) : null,
      collaboration_parties: parties.map((p: string) => encField(p, groupKey) ?? p),
    }).eq('id', project.id).eq('group_id', groupId)
    setEditSaving(false)
    if (error) { alert('保存失败：' + error.message); return }
    setShowEditProject(false)
    window.location.reload()
  }

  const [tab, setTab] = useState<'records' | 'time'>('records')
  const [records, setRecords]         = useState<any[]>([])
  const [timeLogs, setTimeLogs]       = useState<any[]>([])
  const [displayRecords, setDisplayRecords] = useState<any[]>([])
  const [displayTimeLogs, setDisplayTimeLogs] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)
  const [showTimeStats,  setShowTimeStats]  = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const [showAddRecord,  setShowAddRecord]  = useState(false)
  const [recordDate,     setRecordDate]     = useState(today)
  const [recordContent,  setRecordContent]  = useState('')
  const [savingRecord,   setSavingRecord]   = useState(false)

  const [showAddTime,  setShowAddTime]  = useState(false)
  const [timeDate,     setTimeDate]     = useState(today)
  const [timeStart,    setTimeStart]    = useState('09:00')
  const [timeEnd,      setTimeEnd]      = useState('10:00')
  const [timeContent,  setTimeContent]  = useState('')
  const [savingTime,   setSavingTime]   = useState(false)

  async function loadRecords() {
    const { data, error } = await supabase
      .from('work_records')
      .select('*, profiles!work_records_author_id_fkey(name)')
      .eq('project_id', project.id)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
    if (error) console.error('loadRecords error:', error.message)
    setRecords(data || [])
  }

  async function loadTimeLogs() {
    const { data, error } = await supabase
      .from('time_logs')
      .select('*, profiles!time_logs_member_id_fkey(name)')
      .eq('project_id', project.id)
      .eq('group_id', groupId)
      .order('started_at', { ascending: false })
    if (error) console.error('loadTimeLogs error:', error.message)
    setTimeLogs(data || [])
  }

  useEffect(() => {
    setCurrentUserId(profile?.id || null)
    loadRecords()
    loadTimeLogs()

    const channel = supabase
      .channel(`project-${project.id}-${groupId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'work_records',
        filter: `project_id=eq.${project.id}`,
      }, () => loadRecords())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [project.id])

  useEffect(() => {
    setDisplayRecords(
      records.map(r => ({ ...r, content: decField(r.content, groupKey) }))
    )
  }, [records, groupKey])

  useEffect(() => {
    setDisplayTimeLogs(
      timeLogs.map(l => ({ ...l, description: decField(l.description, groupKey) }))
    )
  }, [timeLogs, groupKey])

  async function saveRecord() {
    if (!recordContent.trim()) return
    setSavingRecord(true)
    const [y, mo, d] = recordDate.split('-').map(Number)
    const createdAt = new Date(y, mo - 1, d, 12, 0, 0).toISOString()
    const { error } = await supabase.from('work_records').insert({
      project_id: project.id,
      group_id:   groupId,
      content:    encField(recordContent.trim(), groupKey) ?? recordContent.trim(),
      author_id:  profile?.id,
      created_at: createdAt,
    })
    if (error) { alert('保存失败：' + error.message); setSavingRecord(false); return }
    await loadRecords()
    setRecordContent('')
    setRecordDate(today)
    setSavingRecord(false)
    setShowAddRecord(false)
  }

  async function softDeleteRecord(id: string) {
    if (!confirm('确认标记该记录为已删除？')) return
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', profile?.id).single()
    const { error } = await supabase.from('work_records').update({
      deleted: true, deleted_by: profile?.id || null,
      deleted_by_name: prof?.name || '未知',
      deleted_at: new Date().toISOString(),
    }).eq('id', id).eq('group_id', groupId)
    if (error) { alert('删除失败：' + error.message); return }
    loadRecords()
  }

  async function hardDeleteRecord(id: string) {
    if (!confirm('确认永久删除该记录？此操作不可恢复。')) return
    const { error } = await supabase.from('work_records').delete().eq('id', id).eq('group_id', groupId)
    if (error) alert('删除失败：' + error.message)
    else loadRecords()
  }

  async function addTimeLog() {
    if (!timeDate || !timeStart || !timeEnd) { alert('请填写日期和时间'); return }
    if (timeEnd <= timeStart) { alert('结束时间必须晚于开始时间'); return }
    setSavingTime(true)
    const { error } = await supabase.from('time_logs').insert({
      project_id:  project.id,
      group_id:    groupId,
      member_id:   profile?.id,
      started_at:  localDatetime(timeDate, timeStart),
      finished_at: localDatetime(timeDate, timeEnd),
      description: encField(timeContent.trim(), groupKey) ?? timeContent.trim(),
    })
    if (error) { alert('保存失败：' + error.message); setSavingTime(false); return }
    await loadTimeLogs()
    setTimeContent('')
    setTimeDate(today)
    setTimeStart('09:00')
    setTimeEnd('10:00')
    setSavingTime(false)
    setShowAddTime(false)
  }

  async function softDeleteTimeLog(id: string) {
    if (!confirm('确认标记该工时记录为已删除？')) return
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', profile?.id).single()
    const { error } = await supabase.from('time_logs').update({
      deleted: true, deleted_by: profile?.id || null,
      deleted_by_name: prof?.name || '未知',
      deleted_at: new Date().toISOString(),
    }).eq('id', id).eq('group_id', groupId)
    if (error) { alert('删除失败：' + error.message); return }
    loadTimeLogs()
  }

  async function hardDeleteTimeLog(id: string) {
    if (!confirm('确认永久删除该工时记录？此操作不可恢复。')) return
    const { error } = await supabase.from('time_logs').delete().eq('id', id).eq('group_id', groupId)
    if (error) alert('删除失败：' + error.message)
    else loadTimeLogs()
  }

  async function changeStatus(newStatus: string) {
    setStatusChanging(true)
    await supabase.from('projects').update({ status: newStatus }).eq('id', project.id).eq('group_id', groupId)
    setStatusChanging(false)
    window.location.reload()
  }

  const isAdmin = ['first_admin', 'second_admin', 'admin'].includes(profile?.role || '')

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900 text-sm truncate">{project.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">委托方：{project.client || '—'}</p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {project.agreement_party && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {project.agreement_party}
              </span>
            )}
            {project.service_fee_currency && (
              <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                {project.service_fee_currency}
                {project.service_fee_amount != null && (
                  <> {Number(project.service_fee_amount).toLocaleString()}</>
                )}
              </span>
            )}
          </div>
          {project.collaboration_parties?.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              协作：{(project.collaboration_parties as string[]).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
          {isAdmin && (
            <button
              onClick={openEditProject}
              className="text-[11px] text-gray-400 hover:text-teal-600 border border-gray-200
                         hover:border-teal-400 rounded px-1.5 py-0.5 transition-colors leading-none"
            >
              修改
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>
      </div>

      {/* Status + admin controls */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <span className={`status-tag st-${project.status}`}>
          {STATUS_LABELS[project.status] || project.status}
        </span>
        {isAdmin && (
          <select
            defaultValue={project.status}
            disabled={statusChanging}
            onChange={e => changeStatus(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white
                       focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="active">进行中</option>
            <option value="delayed">已取消</option>
            <option value="completed">已完成</option>
            <option value="cancelled">未启动</option>
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {(['records', 'time'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === t ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'records' ? '工作记录' : '工时记录'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* ── Work Records Tab ── */}
        {tab === 'records' && (
          <>
            <div className="mb-3">
              <button onClick={() => setShowAddRecord(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                           border border-teal-300 text-teal-600 text-sm font-medium
                           hover:bg-teal-50 transition-colors">
                + 添加
              </button>
            </div>

            {displayRecords.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">暂无工作记录</p>
            )}
            {displayRecords.map((r: any) => {
              const canSoftDelete = !r.deleted
              const canHardDelete = r.deleted && isAdmin
              return (
                <div key={r.id} className={`record-entry ${r.deleted ? 'deleted' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{r.profiles?.name || '未知'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{formatDateOnly(r.created_at)}</span>
                      {r.deleted && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          已删除{r.deleted_by_name ? ` · ${r.deleted_by_name}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm text-gray-800 leading-relaxed ${r.deleted ? 'line-through text-gray-400' : ''}`}>
                    {r.content}
                  </p>
                  <div className="flex gap-2 mt-1.5">
                    {canSoftDelete && (
                      <button onClick={() => softDeleteRecord(r.id)} className="text-xs text-amber-500 hover:text-amber-700">
                        标记删除
                      </button>
                    )}
                    {canHardDelete && (
                      <button onClick={() => hardDeleteRecord(r.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        永久删除
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── Time Logs Tab ── */}
        {tab === 'time' && (
          <>
            <div className="mb-3 flex gap-2">
              <button onClick={() => setShowAddTime(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                           border border-teal-300 text-teal-600 text-sm font-medium
                           hover:bg-teal-50 transition-colors">
                + 添加
              </button>
              <button onClick={() => setShowTimeStats(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium
                           hover:bg-gray-50 transition-colors">
                统计
              </button>
            </div>

            {displayTimeLogs.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">暂无工时记录</p>
            )}

            {displayTimeLogs.map((l: any) => {
              const canSoftDelete = !l.deleted
              const canHardDelete = l.deleted && isAdmin
              const dur = durMinutes(l.started_at, l.finished_at)
              return (
                <div key={l.id} className={`time-entry ${l.deleted ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700">{l.profiles?.name || '未知'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-teal-600">{dur}</span>
                      {l.deleted && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          已删除{l.deleted_by_name ? ` · ${l.deleted_by_name}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-xs text-gray-400 ${l.deleted ? 'line-through' : ''}`}>
                    {formatDateTime(l.started_at)}
                    {l.finished_at && ` — ${new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  {l.description && (
                    <p className={`text-sm text-gray-600 mt-1 ${l.deleted ? 'line-through' : ''}`}>{l.description}</p>
                  )}
                  <div className="flex gap-2 mt-1.5">
                    {canSoftDelete && (
                      <button onClick={() => softDeleteTimeLog(l.id)} className="text-xs text-amber-500 hover:text-amber-700">删除</button>
                    )}
                    {canHardDelete && (
                      <button onClick={() => hardDeleteTimeLog(l.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">永久删除</button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* ── Add Work Record Modal ── */}
      {showAddRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">添加工作记录</h3>
              <button onClick={() => setShowAddRecord(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea value={recordContent} onChange={e => setRecordContent(e.target.value)}
                  placeholder="工作内容…" rows={4} className="input-field resize-none" autoFocus />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddRecord(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={saveRecord} disabled={savingRecord || !recordContent.trim()}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {savingRecord ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Time Log Statistics Modal ── */}
      {showTimeStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">工时统计</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{project.name}</p>
              </div>
              <button onClick={() => setShowTimeStats(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            {(() => {
              const nonDeleted = displayTimeLogs.filter((l: any) => !l.deleted)
              const totalMins = nonDeleted.reduce((sum: number, l: any) => {
                if (!l.finished_at) return sum
                return sum + Math.round((new Date(l.finished_at).getTime() - new Date(l.started_at).getTime()) / 60000)
              }, 0)
              return (
                <div className="px-6 py-2.5 bg-teal-50 border-b border-teal-100 flex-shrink-0 flex items-center gap-4 text-sm">
                  <span className="text-teal-700">共 <strong>{nonDeleted.length}</strong> 条有效记录</span>
                  <span className="text-teal-700">合计 <strong>{totalMins}</strong> 分钟</span>
                </div>
              )
            })()}
            <div className="flex-1 overflow-y-auto">
              {displayTimeLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">暂无工时记录</p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-gray-500">
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-20">日期</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-16">开始</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-16">结束</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-16">时长</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium">内容</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 font-medium w-14">操作人</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...displayTimeLogs]
                      .sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                      .map((l: any) => {
                        const dur      = durMinutes(l.started_at, l.finished_at)
                        const dateStr  = new Date(l.started_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                        const startStr = new Date(l.started_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                        const endStr   = l.finished_at
                          ? new Date(l.finished_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                          : '—'
                        return (
                          <tr key={l.id} className={`hover:bg-gray-50 ${l.deleted ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{dateStr}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{startStr}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-600">{endStr}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-teal-600 font-semibold">{dur}</td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-800 whitespace-pre-wrap">
                              {l.description || '—'}
                              {l.deleted && <span className="ml-1 text-red-400">[已删除]</span>}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-100 text-gray-500">{l.profiles?.name || '—'}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Project Modal (Task 5) ── */}
      {showEditProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">修改项目信息</h3>
              <button onClick={() => setShowEditProject(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  委托方 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={editForm.client}
                  onChange={e => setEditForm(f => ({ ...f, client: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目描述</label>
                <textarea value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="input-field resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_EDIT_OPTIONS.map(s => (
                    <button key={s.value} type="button"
                      onClick={() => setEditForm(f => ({ ...f, status: s.value }))}
                      className={`py-1.5 px-3 text-sm rounded-lg border transition-colors text-left
                        ${editForm.status === s.value
                          ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">签约方</label>
                <input type="text" value={editForm.agreement_party}
                  onChange={e => setEditForm(f => ({ ...f, agreement_party: e.target.value }))}
                  className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费币种</label>
                  <select value={editForm.service_fee_currency}
                    onChange={e => setEditForm(f => ({ ...f, service_fee_currency: e.target.value }))}
                    className="input-field">
                    <option value="">—</option>
                    <option value="CNY">CNY</option>
                    <option value="KRW">KRW</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务费金额</label>
                  <input type="number" value={editForm.service_fee_amount}
                    onChange={e => setEditForm(f => ({ ...f, service_fee_amount: e.target.value }))}
                    className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">协作方</label>
                <input type="text" value={editForm.collaboration_parties}
                  onChange={e => setEditForm(f => ({ ...f, collaboration_parties: e.target.value }))}
                  placeholder="多个协作方用逗号分隔" className="input-field" />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={() => setShowEditProject(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={saveEditProject} disabled={editSaving}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {editSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Time Log Modal ── */}
      {showAddTime && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">添加工时记录</h3>
              <button onClick={() => setShowAddTime(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input type="date" value={timeDate} onChange={e => setTimeDate(e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="bg-teal-50 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">合计时长</span>
                <span className="text-sm font-semibold text-teal-700">{calcTotal(timeStart, timeEnd)}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">工作内容</label>
                <textarea value={timeContent} onChange={e => setTimeContent(e.target.value)}
                  placeholder="本次工作内容（可留空）…" rows={3} className="input-field resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddTime(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={addTimeLog} disabled={savingTime}
                className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700
                           rounded-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                {savingTime ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
