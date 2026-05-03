'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { decField } from '@/lib/e2e'

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

const COURT_TYPES = ['court_hearing', 'filing_deadline', 'statute_of_limitations']

function fmtDate(d: string) {
  return `${d.slice(5, 7)}/${d.slice(8, 10)}`
}

function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : ''
}

function urgencyBg(due: string | null, today: string) {
  if (!due) return 'border-gray-200 bg-white'
  if (due < today) return 'border-l-4 border-red-400 bg-red-50'
  if (due === today) return 'border-l-4 border-amber-400 bg-amber-50'
  const diff = (new Date(due).getTime() - new Date(today).getTime()) / 86400000
  if (diff <= 3) return 'border-l-4 border-yellow-300 bg-yellow-50'
  return 'border-gray-200 bg-white'
}

function dayLabel(today: string) {
  const d = new Date(today)
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function DailyDashboard({
  profile, groupId, groupName, subdomain, today,
  activeTodos, todayReminders, upcomingReminders, activeProjects,
}: {
  profile: any
  groupId: string
  groupName: string
  subdomain: string
  today: string
  activeTodos: any[]
  todayReminders: any[]
  upcomingReminders: any[]
  activeProjects: any[]
}) {
  const router = useRouter()
  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  // Decrypt project names/clients
  const decProjects = useMemo(() => activeProjects.map(p => ({
    ...p,
    name:   decField(p.name, groupKey),
    client: decField(p.client, groupKey),
  })), [activeProjects, groupKey])

  // Decrypt reminder contents
  const decTodayReminders = useMemo(() => todayReminders.map(r => ({
    ...r, content: decField(r.content, groupKey),
  })), [todayReminders, groupKey])

  const decUpcomingReminders = useMemo(() => upcomingReminders.map(r => ({
    ...r, content: decField(r.content, groupKey),
  })), [upcomingReminders, groupKey])

  // Decrypt todos
  const decTodos = useMemo(() => activeTodos.map(t => ({
    ...t, content: decField(t.content, groupKey),
  })), [activeTodos, groupKey])

  // Split todos: overdue, today, upcoming
  const overdueTodos = decTodos.filter(t => t.due_date && t.due_date < today)
  const todayTodos   = decTodos.filter(t => t.due_date === today)
  const soonTodos    = decTodos.filter(t => t.due_date && t.due_date > today)
  const noDueTodos   = decTodos.filter(t => !t.due_date)

  // Court dates from upcoming reminders (next 14 days)
  const courtDates = decUpcomingReminders.filter(r => COURT_TYPES.includes(r.type))

  // Pre-alerts firing today
  const preAlerts = [...decTodayReminders, ...decUpcomingReminders].filter(r => {
    if (!r.pre_alert_days || r.pre_alert_days.length === 0) return false
    const startDate = r.start_date || r.due_date
    const d = Math.ceil((new Date(startDate).getTime() - new Date(today).getTime()) / 86400000)
    return r.pre_alert_days.includes(d) && d > 0
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} groupId={groupId} groupName={groupName} subdomain={subdomain} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Today</h1>
            <p className="text-xs text-gray-400 mt-0.5">{dayLabel(today)}</p>
          </div>
          <button
            onClick={() => router.push(`/${subdomain}/projects`)}
            className="ml-auto text-sm text-teal-600 hover:text-teal-800 font-medium">
            Go to Matters →
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* ── Summary cards ───────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Active Matters"
                value={activeProjects.length}
                color="teal"
                icon="📋"
              />
              <StatCard
                label="Overdue Todos"
                value={overdueTodos.length}
                color={overdueTodos.length > 0 ? 'red' : 'gray'}
                icon="⚠️"
              />
              <StatCard
                label="Due Today"
                value={todayTodos.length}
                color={todayTodos.length > 0 ? 'amber' : 'gray'}
                icon="📌"
              />
              <StatCard
                label="Today's Events"
                value={decTodayReminders.length}
                color="blue"
                icon="🗓️"
              />
            </div>

            {/* ── Feature 15: Pre-alerts firing today ─────────── */}
            {preAlerts.length > 0 && (
              <Section title="⚡ Pre-alerts" badge={preAlerts.length} badgeColor="orange">
                <div className="space-y-2">
                  {preAlerts.map(r => {
                    const startDate = r.start_date || r.due_date
                    const d = Math.ceil((new Date(startDate).getTime() - new Date(today).getTime()) / 86400000)
                    return (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
                        <span className="text-sm font-bold text-orange-600 min-w-10">⚡ {d}d</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-orange-800">{r.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-orange-600">Event on {fmtDate(startDate)}</span>
                            {r.type && r.type !== 'others' && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[r.type]}`}>
                                {TYPE_LABELS[r.type]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* ── Today's events ───────────────────────────────── */}
            {decTodayReminders.length > 0 && (
              <Section title="Today's Events" badge={decTodayReminders.length} badgeColor="blue">
                <div className="space-y-2">
                  {decTodayReminders.map(r => (
                    <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="flex-shrink-0 text-center min-w-10">
                        {r.start_time ? (
                          <>
                            <p className="text-xs font-bold text-amber-700">{fmtTime(r.start_time)}</p>
                            {r.end_time && <p className="text-[10px] text-amber-500">{fmtTime(r.end_time)}</p>}
                          </>
                        ) : (
                          <p className="text-xs text-amber-400">All day</p>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-900">{r.content}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {r.type && r.type !== 'others' && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[r.type]}`}>
                              {TYPE_LABELS[r.type]}
                            </span>
                          )}
                          {r.assigned_to_name && (
                            <span className="text-[10px] text-indigo-500 font-medium">@{r.assigned_to_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Feature 16: Court dates (next 14 days) ──────── */}
            {courtDates.length > 0 && (
              <Section title="⚖️ Upcoming Court Dates" badge={courtDates.length} badgeColor="rose" subtitle="Next 14 days">
                <div className="space-y-2">
                  {courtDates.map(r => {
                    const startDate = r.start_date || r.due_date
                    const d = Math.ceil((new Date(startDate).getTime() - new Date(today).getTime()) / 86400000)
                    const isUrgent = d <= 3
                    return (
                      <div key={r.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border
                          ${isUrgent ? 'border-rose-300 bg-rose-50' : 'border-red-200 bg-red-50/50'}`}>
                        <div className="flex-shrink-0 text-center min-w-12">
                          <p className={`text-sm font-bold ${isUrgent ? 'text-rose-700' : 'text-red-600'}`}>
                            {fmtDate(startDate)}
                          </p>
                          <p className={`text-[10px] font-semibold ${isUrgent ? 'text-rose-600' : 'text-red-400'}`}>
                            {d}d left
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isUrgent ? 'text-rose-900' : 'text-red-800'}`}>
                            {r.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[r.type]}`}>
                              {TYPE_LABELS[r.type]}
                            </span>
                            {r.start_time && (
                              <span className="text-[10px] text-gray-500">
                                {fmtTime(r.start_time)}{r.end_time ? `–${fmtTime(r.end_time)}` : ''}
                              </span>
                            )}
                            {r.assigned_to_name && (
                              <span className="text-[10px] text-indigo-500">@{r.assigned_to_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ── Todos ───────────────────────────────────────── */}
              <div className="space-y-4">
                {overdueTodos.length > 0 && (
                  <Section title="Overdue" badge={overdueTodos.length} badgeColor="red">
                    <TodoList todos={overdueTodos} today={today} />
                  </Section>
                )}
                {todayTodos.length > 0 && (
                  <Section title="Due Today" badge={todayTodos.length} badgeColor="amber">
                    <TodoList todos={todayTodos} today={today} />
                  </Section>
                )}
                {soonTodos.length > 0 && (
                  <Section title="Coming Up" badge={soonTodos.length} badgeColor="gray">
                    <TodoList todos={soonTodos} today={today} />
                  </Section>
                )}
                {noDueTodos.length > 0 && (
                  <Section title="No Due Date" badge={noDueTodos.length} badgeColor="gray">
                    <TodoList todos={noDueTodos} today={today} />
                  </Section>
                )}
                {decTodos.length === 0 && (
                  <Section title="Todos" badgeColor="gray">
                    <p className="text-sm text-gray-400 py-2 text-center">All caught up ✓</p>
                  </Section>
                )}
              </div>

              {/* ── Active Matters + Upcoming Events ────────────── */}
              <div className="space-y-4">
                {/* Upcoming reminders (next 14 days, non-court) */}
                {decUpcomingReminders.filter(r => !COURT_TYPES.includes(r.type)).length > 0 && (
                  <Section title="Upcoming Events" subtitle="Next 14 days" badgeColor="blue"
                    badge={decUpcomingReminders.filter(r => !COURT_TYPES.includes(r.type)).length}>
                    <div className="space-y-1.5">
                      {decUpcomingReminders
                        .filter(r => !COURT_TYPES.includes(r.type))
                        .map(r => {
                          const startDate = r.start_date || r.due_date
                          const d = Math.ceil((new Date(startDate).getTime() - new Date(today).getTime()) / 86400000)
                          return (
                            <div key={r.id} className="flex items-center gap-3 py-1.5 px-2 rounded border border-gray-100 hover:border-gray-200 bg-white">
                              <span className="text-xs font-bold text-teal-600 min-w-10">{fmtDate(startDate)}</span>
                              <p className="text-sm text-gray-700 flex-1 truncate">{r.content}</p>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{d}d</span>
                            </div>
                          )
                        })}
                    </div>
                  </Section>
                )}

                {/* Active matters */}
                <Section title="Active Matters" badge={decProjects.length} badgeColor="teal">
                  {decProjects.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2 text-center">No active matters</p>
                  ) : (
                    <div className="space-y-1.5">
                      {decProjects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => router.push(`/${subdomain}/projects`)}
                          className="w-full text-left flex items-center gap-3 py-2 px-2 rounded border border-gray-100 hover:border-teal-200 hover:bg-teal-50/40 bg-white transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                            <p className="text-xs text-gray-400 truncate">{p.client}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full flex-shrink-0">Active</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helper components ────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: string
}) {
  const colorMap: Record<string, string> = {
    teal:  'bg-teal-50 border-teal-200 text-teal-700',
    red:   'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue:  'bg-blue-50 border-blue-200 text-blue-700',
    gray:  'bg-gray-50 border-gray-200 text-gray-500',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  )
}

function Section({ title, subtitle, badge, badgeColor, children }: {
  title: string; subtitle?: string; badge?: number; badgeColor: string; children: React.ReactNode
}) {
  const badgeMap: Record<string, string> = {
    teal:   'bg-teal-100 text-teal-700',
    red:    'bg-red-100 text-red-700',
    amber:  'bg-amber-100 text-amber-700',
    blue:   'bg-blue-100 text-blue-700',
    gray:   'bg-gray-100 text-gray-500',
    orange: 'bg-orange-100 text-orange-700',
    rose:   'bg-rose-100 text-rose-700',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {badge !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeMap[badgeColor] || badgeMap.gray}`}>
            {badge}
          </span>
        )}
        {subtitle && <span className="text-xs text-gray-400 ml-1">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function TodoList({ todos, today }: { todos: any[]; today: string }) {
  return (
    <div className="space-y-1.5">
      {todos.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 py-2 px-3 rounded-lg border text-sm ${urgencyBg(t.due_date, today)}`}>
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 truncate">{t.content}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {t.assignee_abbrev && (
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                {t.assignee_abbrev}
              </span>
            )}
            {t.due_date && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                ${t.due_date < today ? 'bg-red-100 text-red-600'
                  : t.due_date === today ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'}`}>
                {t.due_date.slice(5)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
