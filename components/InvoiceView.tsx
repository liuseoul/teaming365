'use client'
import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import { useE2E } from '@/lib/useE2E'
import { useGroupKey } from '@/lib/useGroupKey'
import { decField } from '@/lib/e2e'

function fmtDuration(started: string, finished: string | null): { label: string; minutes: number } {
  if (!finished) return { label: '—', minutes: 0 }
  const m = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 60000)
  if (m <= 0) return { label: '—', minutes: 0 }
  const h = Math.floor(m / 60), min = m % 60
  return { label: h > 0 ? `${h}h ${min > 0 ? min + 'm' : ''}`.trim() : `${min}m`, minutes: m }
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(amount)
}

export default function InvoiceView({
  profile, group, groupId, subdomain, projects: rawProjects,
}: {
  profile: any
  group: { id: string; name: string; firm_name_en: string; firm_name_cn: string }
  groupId: string
  subdomain: string
  projects: any[]
}) {
  const supabase = createClient()
  const { keyPair } = useE2E(profile?.id || null)
  const groupKey = useGroupKey(profile?.id || null, groupId, keyPair)

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo,   setDateTo]   = useState(today)
  const [hourlyRate, setHourlyRate] = useState('')
  const [currency,   setCurrency]   = useState('USD')
  const [timeLogs,   setTimeLogs]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [generated,  setGenerated]  = useState(false)
  const [invoiceNo,  setInvoiceNo]  = useState(() => `INV-${Date.now().toString().slice(-6)}`)

  const printRef = useRef<HTMLDivElement>(null)

  // Decrypt project list
  const projects = useMemo(() => rawProjects.map(p => ({
    ...p,
    name:   decField(p.name, groupKey),
    client: decField(p.client, groupKey),
  })), [rawProjects, groupKey])

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  async function generateInvoice() {
    if (!selectedProjectId) { alert('Please select a matter'); return }
    setLoading(true); setGenerated(false)
    const s = `${dateFrom}T00:00:00.000Z`
    const e = `${dateTo}T23:59:59.999Z`
    const { data, error } = await supabase
      .from('time_logs')
      .select('id, started_at, finished_at, description, billable, profiles!time_logs_member_id_fkey(name)')
      .eq('project_id', selectedProjectId)
      .eq('group_id', groupId)
      .eq('deleted', false)
      .eq('billable', true)
      .gte('started_at', s)
      .lte('started_at', e)
      .order('started_at', { ascending: true })
    if (!error) {
      setTimeLogs((data || []).map(l => ({ ...l, description: decField(l.description, groupKey) })))
      setGenerated(true)
    } else {
      alert('Failed to load time entries: ' + error.message)
    }
    setLoading(false)
  }

  // Compute totals
  const totalMinutes = timeLogs.reduce((acc, l) => acc + fmtDuration(l.started_at, l.finished_at).minutes, 0)
  const totalHours   = totalMinutes / 60
  const rate         = parseFloat(hourlyRate) || 0
  const totalAmount  = totalHours * rate

  function handlePrint() {
    window.print()
  }

  const firmName = group.firm_name_en || group.firm_name_cn || group.name

  return (
    <Sidebar profile={profile} groupId={groupId} groupName={group.name} subdomain={subdomain}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; }
          body { background: white !important; }
          @page { margin: 20mm; }
        }
      `}</style>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-gray-50">
        {/* Controls (hidden on print) */}
        <div className="no-print flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Invoice Generator</h1>
        </div>

        <div className="no-print px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Matter</label>
              <select value={selectedProjectId} onChange={e => { setSelectedProjectId(e.target.value); setGenerated(false) }}
                className="input-field">
                <option value="">— Select matter —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setGenerated(false) }}
                className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input type="date" value={dateTo} min={dateFrom} onChange={e => { setDateTo(e.target.value); setGenerated(false) }}
                className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Invoice #</label>
              <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hourly rate (optional)</label>
              <input type="number" min="0" step="0.01" value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                placeholder="e.g. 300" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-field">
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                <option value="KRW">KRW</option>
                <option value="EUR">EUR</option>
                <option value="HKD">HKD</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={generateInvoice} disabled={loading || !selectedProjectId}
              className="btn-primary">
              {loading ? 'Loading…' : 'Generate Invoice'}
            </button>
            {generated && (
              <button onClick={handlePrint}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-900 rounded-lg transition-colors">
                🖨 Print / Save PDF
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!generated ? (
            <div className="max-w-3xl mx-auto flex items-center justify-center h-48 text-gray-400 text-sm">
              Select a matter and click Generate Invoice
            </div>
          ) : (
            /* ── Invoice document ─────────────────────────────── */
            <div ref={printRef}
              className="print-area max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-10">

              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{firmName}</h1>
                  <p className="text-sm text-gray-500 mt-1">{group.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-teal-600">INVOICE</p>
                  <p className="text-sm text-gray-500 mt-1">#{invoiceNo}</p>
                  <p className="text-sm text-gray-500">Date: {today}</p>
                </div>
              </div>

              <div className="h-px bg-gray-200 mb-6" />

              {/* Matter & Client */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
                  <p className="text-base font-semibold text-gray-900">{selectedProject?.client || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Matter</p>
                  <p className="text-base font-semibold text-gray-900">{selectedProject?.name || '—'}</p>
                  <p className="text-sm text-gray-500 mt-0.5">Period: {dateFrom} – {dateTo}</p>
                </div>
              </div>

              {/* Line items */}
              {timeLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  No billable time entries for this period
                </div>
              ) : (
                <table className="w-full text-sm mb-6">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase w-24">Date</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Member</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase w-20">Duration</th>
                      {rate > 0 && (
                        <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase w-24">Amount</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {timeLogs.map(l => {
                      const { label, minutes } = fmtDuration(l.started_at, l.finished_at)
                      const amount = rate > 0 ? (minutes / 60) * rate : 0
                      return (
                        <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2.5 pr-4 text-gray-500 text-xs">
                            {new Date(l.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-700 font-medium text-xs">
                            {(l as any).profiles?.name || '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-800">{l.description || '—'}</td>
                          <td className="py-2.5 pr-4 text-gray-700 text-right font-mono text-xs">{label}</td>
                          {rate > 0 && (
                            <td className="py-2.5 text-gray-800 text-right font-mono text-xs">
                              {fmtMoney(amount, currency)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total billable time</span>
                    <span className="font-semibold text-gray-900">
                      {Math.floor(totalHours)}h {Math.round((totalHours % 1) * 60)}m
                    </span>
                  </div>
                  {rate > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Hourly rate</span>
                        <span className="text-gray-700">{fmtMoney(rate, currency)}</span>
                      </div>
                      <div className="h-px bg-gray-200" />
                      <div className="flex justify-between text-base font-bold">
                        <span className="text-gray-900">Total</span>
                        <span className="text-teal-700">{fmtMoney(totalAmount, currency)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-12 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-400 text-center">
                  Generated by Team365 · {firmName} · {today}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  )
}
