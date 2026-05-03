'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn, useAuth, useClerk } from '@clerk/nextjs'

type Group = { id: string; name: string; description: string; role: string; subdomain: string | null }

/* ── Brand name component ───────────────────────────────────── */
function BrandName({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const baseClass = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-base'
  return (
    <span className={`font-semibold ${baseClass}`}>
      Team<span
        className="font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent"
        style={{ fontVariantNumeric: 'oldstyle-nums' }}
      >365</span>
    </span>
  )
}

/* ── Left panel: teamwork illustration ──────────────────────── */
function TeamIllustration() {
  return (
    <div className="flex flex-col items-center gap-8 select-none">
      <svg viewBox="0 0 280 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-64 h-64">
        {/* Outer decorative rings */}
        <circle cx="140" cy="145" r="118" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx="140" cy="145" r="85"  stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <circle cx="140" cy="145" r="52"  stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* Connection lines from leader to each member */}
        <line x1="140" y1="88" x2="62"  y2="188" stroke="rgba(20,184,166,0.35)" strokeWidth="1.5" strokeDasharray="5 4" />
        <line x1="140" y1="88" x2="140" y2="196" stroke="rgba(20,184,166,0.35)" strokeWidth="1.5" strokeDasharray="5 4" />
        <line x1="140" y1="88" x2="218" y2="188" stroke="rgba(20,184,166,0.35)" strokeWidth="1.5" strokeDasharray="5 4" />

        {/* Horizontal connection between members */}
        <path d="M76 210 Q140 228 204 210" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 5" fill="none" />

        {/* ── Leader (top center) ── */}
        {/* Glow halo */}
        <circle cx="140" cy="62" r="28" fill="rgba(20,184,166,0.15)" />
        <circle cx="140" cy="62" r="22" fill="rgba(20,184,166,0.25)" />
        {/* Head */}
        <circle cx="140" cy="62" r="16" fill="#0d9488" />
        {/* Crown */}
        <path d="M128 48 L133 56 L140 44 L147 56 L152 48" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" fill="none" />
        {/* Body */}
        <path d="M127 78 C124 92 122 108 122 118 L158 118 C158 108 156 92 153 78 Q147 74 140 74 Q133 74 127 78Z" fill="#0d9488" opacity="0.85" />
        {/* Arms spread wide — leader gesture */}
        <path d="M122 88 Q106 84 94 90" stroke="#0d9488" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M158 88 Q174 84 186 90" stroke="#0d9488" strokeWidth="5" strokeLinecap="round" fill="none" />

        {/* ── Member 1 (bottom-left) ── */}
        <circle cx="62" cy="198" r="13" fill="#475569" />
        <circle cx="62" cy="198" r="13" fill="url(#memberGrad)" />
        <path d="M51 211 C49 223 48 235 48 244 L76 244 C76 235 75 223 73 211 Q68 207 62 207 Q56 207 51 211Z" fill="#475569" opacity="0.8" />
        <path d="M51 218 Q42 216 36 220" stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M73 218 Q82 216 88 220" stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* ── Member 2 (bottom-center) ── */}
        <circle cx="140" cy="207" r="13" fill="#475569" />
        <path d="M129 220 C127 232 126 244 126 253 L154 253 C154 244 153 232 151 220 Q146 216 140 216 Q134 216 129 220Z" fill="#475569" opacity="0.8" />
        <path d="M129 227 Q120 225 114 229" stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M151 227 Q160 225 166 229" stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* ── Member 3 (bottom-right) ── */}
        <circle cx="218" cy="198" r="13" fill="#475569" />
        <path d="M207 211 C205 223 204 235 204 244 L232 244 C232 235 231 223 229 211 Q224 207 218 207 Q212 207 207 211Z" fill="#475569" opacity="0.8" />
        <path d="M207 218 Q198 216 192 220" stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M229 218 Q238 216 244 220" stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* Floating dots decoration */}
        <circle cx="38"  cy="108" r="3"   fill="rgba(251,191,36,0.4)" />
        <circle cx="248" cy="98"  r="2.5" fill="rgba(251,191,36,0.3)" />
        <circle cx="88"  cy="36"  r="4"   fill="rgba(255,255,255,0.15)" />
        <circle cx="200" cy="32"  r="2.5" fill="rgba(255,255,255,0.12)" />
        <circle cx="28"  cy="238" r="2"   fill="rgba(255,255,255,0.12)" />
        <circle cx="260" cy="252" r="3"   fill="rgba(255,255,255,0.1)" />
        <circle cx="16"  cy="160" r="1.5" fill="rgba(20,184,166,0.5)" />
        <circle cx="266" cy="170" r="2"   fill="rgba(20,184,166,0.4)" />

        <defs>
          <radialGradient id="memberGrad" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>
        </defs>
      </svg>

      <p className="text-slate-400 text-xs tracking-widest uppercase">Team · Collaborate · Lead</p>
    </div>
  )
}

/* ── Right panel: artistic motto ────────────────────────────── */
function ArtisticMotto() {
  const lines = ['Together', 'Like a journey', 'Step by step', 'Share the harvest']
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {lines.map((line, i) => (
        <div key={i} className="relative flex items-center gap-3 group">
          {/* Left accent dot */}
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-500
            ${i === 0 ? 'bg-amber-400' : i === 3 ? 'bg-teal-400' : 'bg-slate-500 group-hover:bg-slate-300'}`} />

          <span
            className="text-2xl tracking-[0.15em] font-light transition-all duration-300"
            style={{
              color: i === 0 ? '#fbbf24'
                   : i === 3 ? '#2dd4bf'
                   : `rgba(255,255,255,${0.55 + i * 0.1})`,
              textShadow: i === 0 ? '0 0 24px rgba(251,191,36,0.4)'
                        : i === 3 ? '0 0 24px rgba(45,212,191,0.35)'
                        : 'none',
            }}
          >
            {line}
          </span>

          {/* Right accent dot (mirrored) */}
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-500
            ${i === 0 ? 'bg-amber-400' : i === 3 ? 'bg-teal-400' : 'bg-slate-500 group-hover:bg-slate-300'}`} />
        </div>
      ))}

      {/* Decorative divider */}
      <div className="mt-5 flex items-center gap-3 opacity-30">
        <div className="w-12 h-px bg-white" />
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
        <div className="w-12 h-px bg-white" />
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { signIn } = useSignIn() as any
  const { userId, isLoaded: authLoaded } = useAuth()
  const { setActive, signOut } = useClerk()
  // Helper: get the actual Clerk SignUp singleton which has all prototype methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getClerkSignUp = (): any => (window as any).Clerk?.client?.signUp
  const [step, setStep]         = useState<'login' | 'group' | 'reset-email' | 'reset-code' | 'register' | 'register-verify' | 'register-choose' | 'register-create-group'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')

  // ── Register state ───────────────────────────────────────
  const [regName,        setRegName]        = useState('')
  const [regEmail,       setRegEmail]       = useState('')
  const [regPassword,    setRegPassword]    = useState('')
  const [regAffiliation, setRegAffiliation] = useState('')
  const [regCode,        setRegCode]        = useState('')
  const [regLoading,     setRegLoading]     = useState(false)
  const [regMsg,         setRegMsg]         = useState('')
  const [showRegPwd,     setShowRegPwd]     = useState(false)
  const [regClerkUserId, setRegClerkUserId] = useState('')

  // ── Group creation state (post-register) ────────────────
  const [regGroupNameCn,   setRegGroupNameCn]   = useState('')
  const [regGroupNameEn,   setRegGroupNameEn]   = useState('')
  const [regManagerNameEn, setRegManagerNameEn] = useState('')
  const [regGroupSaving,   setRegGroupSaving]   = useState(false)
  const [regGroupMsg,      setRegGroupMsg]      = useState('')

  async function handleRegister() {
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setRegMsg('❌ Please fill in your name, email and password'); return
    }
    if (regPassword.length < 8) { setRegMsg('❌ Password must be at least 8 characters'); return }
    setRegLoading(true); setRegMsg('')
    try {
      // Use the global Clerk singleton — it has all prototype methods and is mutated in place by create()
      const su = getClerkSignUp()
      if (!su) { setRegMsg('❌ Auth service not ready — please refresh'); setRegLoading(false); return }
      await su.create({
        emailAddress: regEmail.trim().toLowerCase(),
        password: regPassword,
        firstName: regName.trim(),
      })
      // su is now mutated with the new state; read status from it
      const regStatus    = su.status
      const regUserId    = su.createdUserId
      const regSessionId = su.createdSessionId
      if (regStatus === 'complete') {
        // No email verification required — save profile and go to choose step
        await saveProfile(regUserId!)
        await setActive!({ session: regSessionId })
        setRegClerkUserId(regUserId!)
        setStep('register-choose')
      } else {
        // Email verification required — su.prepareEmailAddressVerification is now available after create()
        await su.prepareEmailAddressVerification({ strategy: 'email_code' })
        setStep('register-verify')
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || JSON.stringify(err)
      setRegMsg(`❌ ${msg.includes('already') ? 'This email is already registered' : msg}`)
    } finally {
      setRegLoading(false)
    }
  }

  async function handleRegisterVerify() {
    if (!regCode.trim()) { setRegMsg('❌ Please enter the code'); return }
    setRegLoading(true); setRegMsg('')
    try {
      const su = getClerkSignUp()
      if (!su) { setRegMsg('❌ Auth service not ready — please refresh'); setRegLoading(false); return }
      await su.attemptEmailAddressVerification({ code: regCode.trim() })
      const vStatus    = su.status
      const vUserId    = su.createdUserId
      const vSessionId = su.createdSessionId
      if (vStatus === 'complete') {
        const uid = vUserId ?? su.createdUserId ?? ''
        const sid = vSessionId ?? su.createdSessionId
        await saveProfile(uid)
        await setActive!({ session: sid })
        setRegClerkUserId(uid)
        setStep('register-choose')
      } else {
        setRegMsg(`❌ Verification incomplete (status: ${vStatus}), please try again`)
      }
    } catch (err: any) {
      setRegMsg(`❌ ${err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || JSON.stringify(err)}`)
    } finally {
      setRegLoading(false)
    }
  }

  async function saveProfile(clerkUserId: string) {
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkUserId,
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        affiliation: regAffiliation.trim() || null,
      }),
    })
  }

  async function handleCreateGroup() {
    if (!regGroupNameCn.trim() || !regGroupNameEn.trim() || !regManagerNameEn.trim()) {
      setRegGroupMsg('❌ All fields are required'); return
    }
    const enCombined = regGroupNameEn.trim() + regManagerNameEn.trim()
    if (!/[a-zA-Z0-9]/.test(enCombined)) {
      setRegGroupMsg('❌ English name must contain letters or numbers'); return
    }
    setRegGroupSaving(true); setRegGroupMsg('')
    try {
      const res = await fetch('/api/auth/create-group-for-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: regClerkUserId,
          groupNameCn: regGroupNameCn.trim(),
          groupNameEn: regGroupNameEn.trim(),
          managerNameEn: regManagerNameEn.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const errMsg = json.error || 'Creation failed'
        if (errMsg.includes('already') || errMsg.includes('taken')) {
          setRegGroupMsg(`❌ Path "${json.subdomain || ''}" is taken — try a different English name`)
        } else {
          setRegGroupMsg(`❌ ${errMsg}`)
        }
        return
      }
      window.location.href = `/${json.subdomain}/projects`
    } catch {
      setRegGroupMsg('❌ Network error — please try again')
    } finally {
      setRegGroupSaving(false)
    }
  }

  // ── Password reset state ─────────────────────────────────
  const [resetEmail,    setResetEmail]    = useState('')
  const [resetCode,     setResetCode]     = useState('')
  const [resetNewPwd,   setResetNewPwd]   = useState('')
  const [resetLoading,  setResetLoading]  = useState(false)
  const [resetMsg,      setResetMsg]      = useState('')
  const [showNewPwd,    setShowNewPwd]    = useState(false)

  async function handleSendResetCode() {
    if (!resetEmail.trim()) { setResetMsg('Please enter your email'); return }
    setResetLoading(true); setResetMsg('')
    try {
      await signIn!.create({ strategy: 'reset_password_email_code', identifier: resetEmail.trim().toLowerCase() })
      setStep('reset-code')
    } catch (err: any) {
      setResetMsg(`❌ ${err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Failed to send — please check your email'}`)
    } finally {
      setResetLoading(false)
    }
  }

  async function handleVerifyReset() {
    if (!resetCode.trim() || !resetNewPwd) { setResetMsg('Please enter the code and new password'); return }
    if (resetNewPwd.length < 8) { setResetMsg('Password must be at least 8 characters'); return }
    setResetLoading(true); setResetMsg('')
    try {
      const result = await signIn!.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode.trim(),
        password: resetNewPwd,
      } as any)
      if (result.status === 'complete') {
        // Sign out the session Clerk silently created during reset,
        // so the user can log in fresh with the new password.
        await signOut().catch(() => {})
        setEmail(resetEmail.trim().toLowerCase())
        setPassword('')
        setError('✅ Password reset. Sign in with your new password.')
        setStep('login')
        setResetCode(''); setResetNewPwd(''); setShowNewPwd(false)
      } else {
        setResetMsg('❌ Reset incomplete, please try again')
      }
    } catch (err: any) {
      setResetMsg(`❌ ${err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Verification failed'}`)
    } finally {
      setResetLoading(false)
    }
  }

  // Already logged in — redirect away from login page
  // Skip during registration steps: user just set their session, don't auto-redirect yet
  useEffect(() => {
    if (!authLoaded || !userId) return
    if (['register', 'register-verify', 'register-choose', 'register-create-group'].includes(step)) return
    fetch('/api/auth/get-redirect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then(r => r.json())
      .then(({ url, uid: resolvedUid }) => {
        const finalUid = resolvedUid || userId
        if (finalUid) document.cookie = `qt_uid=${encodeURIComponent(finalUid)}; path=/; max-age=86400; SameSite=Lax`
        window.location.href = url && url !== '/login'
          ? `${url}?_uid=${encodeURIComponent(finalUid)}`
          : '/login'
      })
      .catch(() => { window.location.href = '/projects' })
  }, [authLoaded, userId, step])
  const [loading,  setLoading]  = useState(false)
  const [loadStep, setLoadStep] = useState('')
  const [groups,   setGroups]   = useState<Group[]>([])

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')

    try {
      // Step 1: Authenticate with Clerk
      setLoadStep('1/3 Verifying credentials…')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await signIn.create({
        identifier: email.trim().toLowerCase(),
        password,
      })

      // Clerk v7: status and session may be on result or on signIn object itself
      const status    = result?.status    ?? signIn?.status
      const sessionId = result?.createdSessionId ?? signIn?.createdSessionId

      if (status !== 'complete') {
        setError(`Sign-in incomplete (status: ${status}), please try again.`)
        setLoading(false); setLoadStep(''); return
      }

      // Step 2: Activate session
      setLoadStep('2/3 Activating session…')
      setActive!({ session: sessionId }).catch(() => {})

      // Step 3: Route by email (no need for userId — we already have the email)
      setLoadStep('3/3 Getting access…')
      const res = await fetch('/api/auth/get-redirect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const { url, uid } = await res.json()
      if (uid) document.cookie = `qt_uid=${encodeURIComponent(uid)}; path=/; max-age=86400; SameSite=Lax`
      window.location.href = url && url !== '/login'
        ? `${url}?_uid=${encodeURIComponent(uid)}`
        : '/login'
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || String(err)
      setError(`Sign-in failed: ${msg}`)
      setLoading(false)
    }
  }

  function doSelectGroup(group: Group) {
    document.cookie = `qt_group=${group.id}; path=/; max-age=86400; SameSite=Lax`
    router.push(group.subdomain ? `/${group.subdomain}/projects` : '/projects')
    router.refresh()
  }

  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') handleLogin() }

  /* ── Group picker ───────────────────────────────────────── */
  if (step === 'group') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-bold">Q</span>
            </div>
            <h1 className="text-white text-2xl"><BrandName /></h1>
            <p className="text-slate-400 text-sm mt-2">Select a team</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-3">
            {groups.map(g => (
              <button key={g.id} onClick={() => doSelectGroup(g)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200
                           hover:border-teal-500 hover:bg-teal-50 transition-all duration-150 group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-teal-700">{g.name}</div>
                    {g.description && <div className="text-xs text-gray-500 mt-0.5">{g.description}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3
                    ${g.role === 'first_admin'  ? 'bg-purple-100 text-purple-700'
                    : g.role === 'second_admin' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'}`}>
                    {g.role === 'first_admin' ? 'Primary Admin' : g.role === 'second_admin' ? 'Secondary Admin' : 'Member'}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-slate-500 text-xs mt-6">You can switch teams from the sidebar.</p>
        </div>
      </div>
    )
  }

  /* ── Reset: enter email ────────────────────────────────── */
  if (step === 'reset-email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-black">Q</span>
            </div>
            <h1 className="text-white mb-1"><BrandName size="lg" /></h1>
            <p className="text-slate-400 text-sm">Reset password</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
            <p className="text-sm text-gray-600">Enter your email and we&apos;ll send you a reset code.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendResetCode()}
                placeholder="your@email.com" autoFocus
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
            </div>
            {resetMsg && <p className="text-sm text-red-600">{resetMsg}</p>}
            <button onClick={handleSendResetCode} disabled={resetLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors">
              {resetLoading ? 'Sending…' : 'Send reset code'}
            </button>
            <button onClick={() => { setStep('login'); setResetMsg('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 transition-colors">
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Reset: enter code + new password ──────────────────── */
  if (step === 'reset-code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-black">Q</span>
            </div>
            <h1 className="text-white mb-1"><BrandName size="lg" /></h1>
            <p className="text-slate-400 text-sm">Enter the code and set a new password</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
            <p className="text-sm text-gray-500">Code sent to <span className="font-medium text-gray-800">{resetEmail}</span></p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input type="text" value={resetCode} onChange={e => setResetCode(e.target.value)}
                placeholder="6-digit code" autoFocus inputMode="numeric" maxLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400 tracking-widest text-center" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <div className="relative">
                <input type={showNewPwd ? 'text' : 'password'} value={resetNewPwd}
                  onChange={e => setResetNewPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyReset()}
                  placeholder="Min 8 characters" autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400 pr-14" />
                <button type="button" onClick={() => setShowNewPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">
                  {showNewPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {resetMsg && <p className="text-sm text-red-600">{resetMsg}</p>}
            <button onClick={handleVerifyReset} disabled={resetLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors">
              {resetLoading ? 'Verifying…' : 'Reset password'}
            </button>
            <button onClick={() => { setStep('reset-email'); setResetMsg('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 transition-colors">
              ← Resend code
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Register: choose next step ───────────────────────── */
  if (step === 'register-choose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-black">Q</span>
            </div>
            <h1 className="text-white mb-1"><BrandName size="lg" /></h1>
            <p className="text-slate-400 text-sm">Account created! What would you like to do?</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
            <div>
              <button
                onClick={() => setStep('register-create-group')}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg transition-colors">
                Create my team
              </button>
              <p className="text-xs text-gray-400 mt-1.5 text-center">For team leads setting up their workspace</p>
            </div>
            <div>
              <button
                onClick={() => { window.location.href = '/pending' }}
                className="w-full border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium py-2.5 rounded-lg transition-colors">
                Join an existing team
              </button>
              <p className="text-xs text-gray-400 mt-1.5 text-center">For members who&apos;ve been invited to join</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Register: create group ────────────────────────────── */
  if (step === 'register-create-group') {
    const previewSubdomain = (regGroupNameEn + regManagerNameEn).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-black">Q</span>
            </div>
            <h1 className="text-white mb-1"><BrandName size="lg" /></h1>
            <p className="text-slate-400 text-sm">Create a new team</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team name (local) <span className="text-red-500">*</span></label>
              <input type="text" value={regGroupNameCn} onChange={e => setRegGroupNameCn(e.target.value)}
                placeholder="e.g. Johnson & Partners" autoFocus
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team name (English) <span className="text-red-500">*</span></label>
              <input type="text" value={regGroupNameEn} onChange={e => setRegGroupNameEn(e.target.value)}
                placeholder="e.g. JohnsonPartners"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name in English <span className="text-red-500">*</span></label>
              <input type="text" value={regManagerNameEn} onChange={e => setRegManagerNameEn(e.target.value)}
                placeholder="e.g. JohnSmith"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
            </div>
            {previewSubdomain && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
                Team URL: <span className="font-mono font-semibold text-teal-700">teaming365.com/{previewSubdomain}</span>
              </div>
            )}
            {regGroupMsg && <p className="text-sm text-red-600">{regGroupMsg}</p>}
            <button onClick={handleCreateGroup} disabled={regGroupSaving}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors">
              {regGroupSaving ? 'Creating…' : 'Create team'}
            </button>
            <button onClick={() => { setStep('register-choose'); setRegGroupMsg('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 transition-colors">
              ← Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Register form ─────────────────────────────────────── */
  if (step === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-black">Q</span>
            </div>
            <h1 className="text-white mb-1"><BrandName size="lg" /></h1>
            <p className="text-slate-400 text-sm">Create account</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name <span className="text-red-500">*</span></label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                placeholder="Your full name" autoFocus
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showRegPwd ? 'text' : 'password'} value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  placeholder="Min 8 characters" autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400 pr-14" />
                <button type="button" onClick={() => setShowRegPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">
                  {showRegPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <input type="text" value={regAffiliation} onChange={e => setRegAffiliation(e.target.value)}
                placeholder="Firm / school (optional)"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
            </div>
            {regMsg && <p className="text-sm text-red-600">{regMsg}</p>}
            <button onClick={handleRegister} disabled={regLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors">
              {regLoading ? 'Creating…' : 'Create account'}
            </button>
            <button onClick={() => { setStep('login'); setRegMsg('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 transition-colors">
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Register: email verification ──────────────────────── */
  if (step === 'register-verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-black">Q</span>
            </div>
            <h1 className="text-white mb-1"><BrandName size="lg" /></h1>
            <p className="text-slate-400 text-sm">Verify email</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
            <p className="text-sm text-gray-500">Code sent to <span className="font-medium text-gray-800">{regEmail}</span></p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input type="text" value={regCode} onChange={e => setRegCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegisterVerify()}
                placeholder="6-digit code" autoFocus inputMode="numeric" maxLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400 tracking-widest text-center" />
            </div>
            {regMsg && <p className="text-sm text-red-600">{regMsg}</p>}
            <button onClick={handleRegisterVerify} disabled={regLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-colors">
              {regLoading ? 'Verifying…' : 'Verify & finish'}
            </button>
            <button onClick={() => { setStep('register'); setRegMsg(''); setRegCode('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 transition-colors">
              ← Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Login form ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl flex items-center justify-center gap-0 lg:gap-12 xl:gap-20">

        {/* Left: illustration */}
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <TeamIllustration />
        </div>

        {/* Center: login card */}
        <div className="w-full max-w-sm flex-shrink-0">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4 shadow-lg shadow-teal-900/50">
              <span className="text-white text-2xl font-black">Q</span>
            </div>
            <h1 className="text-white mb-1"><BrandName size="lg" /></h1>
            <p className="text-slate-400 text-sm">Sign in with your email</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="your@email.com" autoFocus autoComplete="email"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                             placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Enter password" autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                             placeholder:text-gray-400"
                />
              </div>
              {error && (
                <div className={`rounded-lg px-4 py-2.5 border ${error.startsWith('✅')
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-sm ${error.startsWith('✅') ? 'text-green-700' : 'text-red-700'}`}>{error}</p>
                </div>
              )}
              <button onClick={handleLogin} disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400
                           text-white font-medium py-2.5 rounded-lg transition-colors duration-150
                           focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
                {loading ? (loadStep || 'Signing in…') : 'Sign in'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setStep('reset-email'); setResetEmail(email); setResetMsg('') }}
                  className="text-gray-400 hover:text-teal-600 transition-colors">
                  Forgot password?
                </button>
                <button type="button" onClick={() => { setStep('register'); setRegMsg('') }}
                  className="text-teal-600 hover:text-teal-800 font-medium transition-colors">
                  Create account →
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-slate-500 text-xs mt-6">Register and ask your team admin to add you.</p>
        </div>

        {/* Right: artistic motto */}
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <ArtisticMotto />
        </div>
      </div>
    </div>
  )
}
