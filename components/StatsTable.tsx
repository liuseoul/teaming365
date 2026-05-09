'use client'
import React from 'react'

export function StatsTable({ loading, queried, records, timeLogs, todos, showOperator, groupByProject }: {
  loading: boolean; queried: boolean
  records: any[]; timeLogs: any[]; todos: any[]
  showOperator: boolean
  groupByProject?: boolean
}) {
  if (loading) return <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
  if (!queried) return (
    <div className="text-center py-16">
      <div className="text-3xl mb-3">📅</div>
      <p className="text-sm text-gray-400">Select a date range and click Confirm</p>
    </div>
  )
  if (records.length === 0 && timeLogs.length === 0 && todos.length === 0)
    return (
      <div className="text-center py-16">
        <div className="text-3xl mb-3">🗂</div>
        <p className="text-sm text-gray-400">No records for this period</p>
      </div>
    )

  function durMins(started: string, finished: string | null) {
    if (!finished) return '—'
    const m = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 60000)
    return m > 0 ? `${m} min` : '—'
  }

  function renderRecordRows() {
    if (!groupByProject) {
      return records.map((r: any) => (
        <tr key={r.id} className="hover:bg-slate-50">
          <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{r.projects?.name || '—'}</td>
          <td className="px-3 py-2 border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">{r.content}</td>
          {showOperator && <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{r.profiles?.name || '—'}</td>}
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
          <tr key={`ph-${pid || 'none'}-${r.id}`} className="bg-slate-50">
            <td colSpan={colSpan} className="px-3 py-1.5 border border-gray-200 text-slate-700 font-semibold text-xs">
              {r.projects?.name || 'Unassigned'}
            </td>
          </tr>
        )
      }
      rows.push(
        <tr key={r.id} className="hover:bg-slate-50">
          <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{r.projects?.name || '—'}</td>
          <td className="px-3 py-2 border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed">{r.content}</td>
          {showOperator && <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{r.profiles?.name || '—'}</td>}
        </tr>
      )
    })
    return rows
  }

  function renderTimeLogRows() {
    if (!groupByProject) {
      return timeLogs.map((l: any) => {
        const startStr = new Date(l.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'
        return (
          <tr key={l.id} className="hover:bg-slate-50">
            <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{l.projects?.name || '—'}</td>
            <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{startStr}–{endStr}</td>
            <td className="px-3 py-2 border border-gray-200 text-slate-700 font-semibold text-xs">{durMins(l.started_at, l.finished_at)}</td>
            <td className="px-3 py-2 border border-gray-200 text-gray-800">{l.description || '—'}</td>
            {showOperator && <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{l.profiles?.name || '—'}</td>}
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
          <tr key={`ph-${pid || 'none'}-${l.id}`} className="bg-slate-50">
            <td colSpan={colSpan} className="px-3 py-1.5 border border-gray-200 text-slate-700 font-semibold text-xs">
              {l.projects?.name || 'Unassigned'}
            </td>
          </tr>
        )
      }
      const startStr = new Date(l.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const endStr   = l.finished_at ? new Date(l.finished_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'
      rows.push(
        <tr key={l.id} className="hover:bg-slate-50">
          <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{l.projects?.name || '—'}</td>
          <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{startStr}–{endStr}</td>
          <td className="px-3 py-2 border border-gray-200 text-slate-700 font-semibold text-xs">{durMins(l.started_at, l.finished_at)}</td>
          <td className="px-3 py-2 border border-gray-200 text-gray-800">{l.description || '—'}</td>
          {showOperator && <td className="px-3 py-2 border border-gray-200 text-gray-500 text-xs">{l.profiles?.name || '—'}</td>}
        </tr>
      )
    })
    return rows
  }

  function renderTodos() {
    if (!showOperator) {
      return (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-gray-500">
              <th className="text-left px-3 py-2 border border-gray-200 font-medium">Task</th>
              <th className="text-left px-3 py-2 border border-gray-200 font-medium w-12">Assignee</th>
              <th className="text-left px-3 py-2 border border-gray-200 font-medium w-16">Done at</th>
            </tr>
          </thead>
          <tbody>
            {todos.map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 border border-gray-200 text-gray-800">{t.content}</td>
                <td className="px-3 py-2 border border-gray-200 text-center text-slate-700 font-bold">{t.assignee_abbrev || '—'}</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-500">
                  {t.completed_at ? new Date(t.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    const groups: { operator: string; items: any[] }[] = []
    const seenOps = new Map<string, number>()
    todos.forEach((t: any) => {
      const op = t.completed_by_name || '—'
      if (seenOps.has(op)) { groups[seenOps.get(op)!].items.push(t) }
      else { seenOps.set(op, groups.length); groups.push({ operator: op, items: [t] }) }
    })
    return (
      <div className="space-y-4">
        {groups.map(({ operator, items }) => (
          <div key={operator}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs font-semibold text-slate-700">{operator}</span>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {items.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border border-gray-200 text-gray-800">{t.content}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-slate-700 font-bold w-12">{t.assignee_abbrev || '—'}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-500 w-16">
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
    <div className="space-y-8">
      {records.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            Work Records <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded">{records.length}</span>
          </h4>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-gray-500">
                <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs w-28">Matter</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs">Content</th>
                {showOperator && <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs w-16">By</th>}
              </tr>
            </thead>
            <tbody>{renderRecordRows()}</tbody>
          </table>
        </div>
      )}

      {timeLogs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            Time Entries <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded">{timeLogs.length}</span>
          </h4>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-gray-500">
                <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs w-28">Matter</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs w-24">Period</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs w-20">Duration</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs">Notes</th>
                {showOperator && <th className="text-left px-3 py-2 border border-gray-200 font-medium text-xs w-16">By</th>}
              </tr>
            </thead>
            <tbody>{renderTimeLogRows()}</tbody>
          </table>
        </div>
      )}

      {todos.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            Completed Todos <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded">{todos.length}</span>
          </h4>
          {renderTodos()}
        </div>
      )}
    </div>
  )
}
