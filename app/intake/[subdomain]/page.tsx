'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'

const MATTER_TYPES = [
  { value: '',             label: 'Select matter type (optional)' },
  { value: 'criminal',    label: 'Criminal' },
  { value: 'corporate',   label: 'Corporate' },
  { value: 'family',      label: 'Family' },
  { value: 'ip',          label: 'Intellectual Property' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'labor',       label: 'Labor & Employment' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'civil',       label: 'Civil' },
  { value: 'other',       label: 'Other' },
]

export default function IntakePage() {
  const { subdomain } = useParams<{ subdomain: string }>()

  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [matterType,  setMatterType]  = useState('')
  const [description, setDescription] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Your name is required'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, name: name.trim(), email: email.trim(), phone: phone.trim(), matterType, description: description.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Submission failed. Please try again.'); return }
      setDone(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto text-3xl">✓</div>
          <h2 className="text-xl font-bold text-gray-900">Request received</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Thank you, <strong>{name}</strong>. Our team will review your enquiry and be in touch shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-600 text-white text-xl mb-3">⚖️</div>
          <h1 className="text-xl font-bold text-gray-900">New Client Enquiry</h1>
          <p className="text-sm text-gray-400 mt-1">Fill in the form below and our team will be in touch.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+1 555 0100"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type of legal matter</label>
            <select
              value={matterType} onChange={e => setMatterType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white">
              {MATTER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brief description of your matter</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Please describe your situation briefly. Do not include confidential information at this stage."
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit" disabled={submitting}
            className="w-full py-3 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 rounded-xl transition-colors">
            {submitting ? 'Submitting…' : 'Submit Enquiry'}
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Your information is used solely to respond to your enquiry. No commitment is created by submitting this form.
          </p>
        </form>
      </div>
    </div>
  )
}
