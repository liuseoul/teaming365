'use client'
import { useMemo } from 'react'
import Sidebar from './Sidebar'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { decField } from '@/lib/e2e'

const MATTER_TYPE_LABELS: Record<string, string> = {
  criminal:       'Criminal',
  corporate:      'Corporate',
  family:         'Family',
  ip:             'IP',
  real_estate:    'Real Estate',
  labor:          'Labor',
  administrative: 'Administrative',
  civil:          'Civil',
  other:          'Other',
}

const STATUS_LABELS: Record<string, string> = {
  active:    'Active',
  delayed:   'Cancelled',
  completed: 'Closed',
  cancelled: 'Declined',
  pending:   'Pending',
  archived:  'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-teal-500',
  completed: 'bg-blue-500',
  pending:   'bg-amber-500',
  cancelled: 'bg-red-400',
  delayed:   'bg-orange-400',
  archived:  'bg-gray-400',
}

function fmtMins(m: number) {
  const h = Math.floor(m / 60), min = m % 60
  return h > 0 ? `${h}h ${min > 0 ? min + 'm' : ''}`.trim() : `${min}m`
}

function fmtAmount(n: number, currency = 'CNY') {
  if (n === 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    maximumFractionDigits: 0,
  }).format(n)
}

// ── Pure-CSS horizontal bar chart ─────────────────────────────
function HBar({ label, value, max, fmtVal, color = 'bg-teal-500' }: {
  label: string; value: number; max: number; fmtVal: (v: number) => string; color?: string
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-28 text-right truncate flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
          style={{ width: `${pct}%` }}>
          {pct > 20 && <span className="text-[10px] text-white font-bold whitespace-nowrap">{fmtVal(value)}</span>}
        </div>
      </div>
      {pct <= 20 && <span className="text-xs text-gray-600 font-semibold w-20 flex-shrink-0">{fmtVal(value)}</span>}
    </div>
  )
}

// ── Vertical bar chart for monthly data ──────────────────────
function VBar({ data, labelFmt, valueFmt, color = 'bg-teal-500', secondaryData, secondaryColor }: {
  data: { key: string; value: number }[]
  labelFmt: (k: string) => string
  valueFmt: (v: number) => string
  color?: string
  secondaryData?: { key: string; value: number }[]
  secondaryColor?: string
}) {
  const max = Math.max(...data.map(d => d.value), ...(secondaryData || []).map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map(d => {
        const sec = secondaryData?.find(s => s.key === d.key)
        const h1 = Math.max(4, Math.round((d.value / max) * 100))
        const h2 = sec ? Math.max(4, Math.round((sec.value / max) * 100)) : 0
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5 group">
            <div className="relative w-full flex items-end gap-0.5" style={{ height: '100%' }}>
              <div className={`${color} rounded-t flex-1 transition-all`} style={{ height: `${h1}%` }}
                title={`${labelFmt(d.key)}: ${valueFmt(d.value)}`} />
              {sec && (
                <div className={`${secondaryColor || 'bg-blue-400'} rounded-t flex-1 transition-all`}
                  style={{ height: `${h2}%` }}
                  title={`${labelFmt(d.key)} (billable): ${valueFmt(sec.value)}`} />
              )}
            </div>
            <span className="text-[9px] text-gray-400 text-center leading-none">
              {labelFmt(d.key)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default function AnalyticsDashboard({
  profile, groupId, groupName, subdomain,
  projects, revenueByType, countByType, statusCount,
  monthlyHours, mattersByMonth,
  totalBillableMins, totalNonBillableMins,
}: {
  profile: any
  groupId: string
  groupName: string
  subdomain: string
  projects: any[]
  revenueByType: Record<string, number>
  countByType: Record<string, number>
  statusCount: Record<string, number>
  monthlyHours: Record<string, { billable: number; total: number }>
  mattersByMonth: Record<string, number>
  totalBillableMins: number
  totalNonBillableMins: number
}) {
  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  // Decrypt client names for top-clients chart
  const clientCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of projects) {
      const name = decField(p.client, groupKey) || '—'
      map[name] = (map[name] || 0) + 1
    }
    return map
  }, [projects, groupKey])

  const topClients = useMemo(() =>
    Object.entries(clientCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value })),
    [clientCount]
  )

  // Revenue by type (sorted, top 8)
  const revenueItems = Object.entries(revenueByType)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([key, value]) => ({ label: MATTER_TYPE_LABELS[key] || key, value }))
  const maxRevenue = Math.max(...revenueItems.map(i => i.value), 1)

  // Count by type
  const countItems = Object.entries(countByType)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ label: MATTER_TYPE_LABELS[key] || key, value }))
  const maxCount = Math.max(...countItems.map(i => i.value), 1)

  // Monthly activity — last 12 months sorted
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    return d.toISOString().slice(0, 7)
  })
  const monthlyHoursData = last12.map(k => ({ key: k, value: Math.round((monthlyHours[k]?.total || 0) / 60 * 10) / 10 }))
  const monthlyBillableData = last12.map(k => ({ key: k, value: Math.round((monthlyHours[k]?.billable || 0) / 60 * 10) / 10 }))
  const matterMonthData = last12.map(k => ({ key: k, value: mattersByMonth[k] || 0 }))

  const totalMins = totalBillableMins + totalNonBillableMins
  const billablePct = totalMins > 0 ? Math.round((totalBillableMins / totalMins) * 100) : 0

  // Status items
  const statusItems = Object.entries(statusCount)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, label: STATUS_LABELS[key] || key, value }))
  const maxStatus = Math.max(...statusItems.map(i => i.value), 1)

  const topClientsMax = Math.max(...topClients.map(c => c.value), 1)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} groupId={groupId} groupName={groupName} subdomain={subdomain} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        <div className="flex items-center px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
          <span className="ml-3 text-sm text-gray-400">· {groupName}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* ── Summary row ───────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SummaryCard label="Total Matters" value={projects.length.toString()} icon="📋" color="teal" />
              <SummaryCard label="Billable Hours" value={fmtMins(totalBillableMins)} icon="💰" color="green" />
              <SummaryCard label="Non-billable" value={fmtMins(totalNonBillableMins)} icon="⏱" color="gray" />
              <SummaryCard label="Billable ratio" value={`${billablePct}%`} icon="📊" color={billablePct >= 70 ? 'teal' : 'amber'} />
            </div>

            {/* ── Hours overview ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Monthly Hours (last 12 months)">
                {totalMins === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No time logs yet</p>
                ) : (
                  <>
                    <VBar
                      data={monthlyHoursData}
                      secondaryData={monthlyBillableData}
                      labelFmt={k => k.slice(5)}
                      valueFmt={v => `${v}h`}
                      color="bg-gray-200"
                      secondaryColor="bg-teal-500"
                    />
                    <div className="flex items-center gap-4 mt-3 justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-teal-500 inline-block" />
                        <span className="text-xs text-gray-500">Billable</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-gray-200 inline-block" />
                        <span className="text-xs text-gray-500">Total</span>
                      </div>
                    </div>
                  </>
                )}
              </Card>

              <Card title="New Matters by Month">
                {projects.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No matters yet</p>
                ) : (
                  <VBar
                    data={matterMonthData}
                    labelFmt={k => k.slice(5)}
                    valueFmt={v => `${v}`}
                    color="bg-indigo-400"
                  />
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by matter type */}
              <Card title="Revenue by Matter Type">
                {revenueItems.length === 0 || maxRevenue === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No fee data set on matters</p>
                ) : (
                  <div className="space-y-1">
                    {revenueItems.map(item => (
                      <HBar key={item.label} label={item.label} value={item.value} max={maxRevenue}
                        fmtVal={v => fmtAmount(v)} color="bg-emerald-500" />
                    ))}
                  </div>
                )}
              </Card>

              {/* Matter count by type */}
              <Card title="Matters by Type">
                {countItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No matters yet</p>
                ) : (
                  <div className="space-y-1">
                    {countItems.map(item => (
                      <HBar key={item.label} label={item.label} value={item.value} max={maxCount}
                        fmtVal={v => v.toString()} color="bg-indigo-400" />
                    ))}
                  </div>
                )}
              </Card>

              {/* Status breakdown */}
              <Card title="Matters by Status">
                {statusItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No matters yet</p>
                ) : (
                  <div className="space-y-1">
                    {statusItems.map(item => (
                      <HBar key={item.key} label={item.label} value={item.value} max={maxStatus}
                        fmtVal={v => v.toString()} color={STATUS_COLORS[item.key] || 'bg-gray-400'} />
                    ))}
                  </div>
                )}
              </Card>

              {/* Top clients */}
              <Card title="Top Clients (by matter count)">
                {topClients.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No client data yet</p>
                ) : (
                  <div className="space-y-1">
                    {topClients.map(item => (
                      <HBar key={item.label} label={item.label} value={item.value} max={topClientsMax}
                        fmtVal={v => `${v} matter${v !== 1 ? 's' : ''}`} color="bg-violet-400" />
                    ))}
                  </div>
                )}
              </Card>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal:  'bg-teal-50 border-teal-200',
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    gray:  'bg-gray-50 border-gray-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
