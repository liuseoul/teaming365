'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import { StatsTable } from './StatsTable'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { decField } from '@/lib/e2e'

export default function MyStatsPage({
  profile, groupId, groupName, subdomain,
}: {
  profile: { id: string; name: string; role: string }
  groupId: string
  groupName: string
  subdomain: string
}) {
  const supabase = createClient()
  const { keyPair } = useE2E(profile.id)
  const groupKey = useGroupKey(profile.id, groupId, keyPair)

  const todayStr = new Date().toISOString().slice(0, 10)
  const firstOfMonth = todayStr.slice(0, 7) + '-01'

  const [mode,       setMode]       = useState<'single' | 'range'>('single')
  const [date,       setDate]       = useState(todayStr)
  const [rangeStart, setRangeStart] = useState(firstOfMonth)
  const [rangeEnd,   setRangeEnd]   = useState(todayStr)
  const [loading,    setLoading]    = useState(false)
  const [queried,    setQueried]    = useState(false)
  const [records,    setRecords]    = useState<any[]>([])
  const [timeLogs,   setTimeLogs]   = useState<any[]>([])
  const [todos,      setTodos]      = useState<any[]>([])

  async function loadStats() {
    setLoading(true); setQueried(true)
    const startDay = mode === 'range' ? rangeStart : date
    const endDay   = mode === 'range' ? rangeEnd   : date
    if (endDay < startDay) {
      alert('End date cannot be before start date')
      setLoading(false); setQueried(false); return
    }
    const s = `${startDay}T00:00:00.000Z`
    const e = `${endDay}T23:59:59.999Z`

    const [{ data: recs }, { data: logs }, { data: tdos }] = await Promise.all([
      supabase.from('work_records')
        .select('id, content, created_at, projects(name)')
        .eq('author_id', profile.id).eq('deleted', false).eq('group_id', groupId)
        .gte('created_at', s).lte('created_at', e).order('created_at', { ascending: true }),
      supabase.from('time_logs')
        .select('id, started_at, finished_at, description, projects(name)')
        .eq('member_id', profile.id).eq('deleted', false).eq('group_id', groupId)
        .gte('started_at', s).lte('started_at', e).order('started_at', { ascending: true }),
      supabase.from('todos')
        .select('id, content, assignee_abbrev, completed_at, completed_by_name')
        .eq('completed', true).eq('deleted', false).eq('group_id', groupId)
        .eq('completed_by_name', profile.name)
        .gte('completed_at', s).lte('completed_at', e).order('completed_at', { ascending: true }),
    ])

    setRecords((recs || []).map((r: any) => ({
      ...r,
      content: decField(r.content, groupKey),
      projects: r.projects ? { ...r.projects, name: decField(r.projects.name, groupKey) } : r.projects,
    })))
    setTimeLogs((logs || []).map((l: any) => ({
      ...l,
      description: decField(l.description, groupKey),
      projects: l.projects ? { ...l.projects, name: decField(l.projects.name, groupKey) } : l.projects,
    })))
    setTodos((tdos || []).map((t: any) => ({ ...t, content: decField(t.content, groupKey) })))
    setLoading(false)
  }

  return (
    <Sidebar profile={profile} groupId={groupId} groupName={groupName} subdomain={subdomain}>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-gray-50">

        {/* Header */}
        <div className="flex items-center px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">My Stats</h1>
          <span className="ml-3 text-sm text-gray-400">· {profile.name}</span>
        </div>

        {/* Controls */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode toggle */}
            <div className="flex gap-1.5">
              <button onClick={() => { setMode('single'); setQueried(false) }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                  ${mode === 'single'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'text-gray-600 hover:bg-gray-100 border-gray-200'}`}>
                Single day
              </button>
              <button onClick={() => { setMode('range'); setQueried(false) }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                  ${mode === 'range'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'text-gray-600 hover:bg-gray-100 border-gray-200'}`}>
                Date range
              </button>
            </div>

            {/* Date inputs */}
            {mode === 'single' ? (
              <input type="date" value={date}
                onChange={e => { setDate(e.target.value); setQueried(false) }}
                className="input-field w-44" />
            ) : (
              <>
                <input type="date" value={rangeStart}
                  onChange={e => { setRangeStart(e.target.value); setQueried(false) }}
                  className="input-field w-40" />
                <span className="text-sm text-gray-400">to</span>
                <input type="date" value={rangeEnd} min={rangeStart}
                  onChange={e => { setRangeEnd(e.target.value); setQueried(false) }}
                  className="input-field w-40" />
              </>
            )}

            <button onClick={loadStats} disabled={loading}
              className="px-5 py-2 text-white text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
              {loading ? 'Loading…' : 'Confirm'}
            </button>

            {queried && !loading && (
              <span className="text-xs text-gray-400 ml-1">
                {records.length + timeLogs.length + todos.length} entries
              </span>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <StatsTable
              loading={loading}
              queried={queried}
              records={records}
              timeLogs={timeLogs}
              todos={todos}
              showOperator={false}
            />
          </div>
        </div>
      </div>
    </Sidebar>
  )
}
