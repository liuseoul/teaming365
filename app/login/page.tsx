'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Group = { id: string; name: string; description: string; role: string; subdomain: string | null }

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep]     = useState<'login' | 'group'>('login')
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [groups,   setGroups]   = useState<Group[]>([])

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码。')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setError('邮箱或密码错误，请联系管理员。')
      setLoading(false)
      return
    }

    const { data: { user: authedUser } } = await supabase.auth.getUser()

    // Use a dedicated API to determine where to redirect after login.
    // This avoids session-timing issues when querying profiles client-side
    // immediately after signInWithPassword.
    const res = await fetch('/api/auth/post-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: authedUser!.id }),
    })
    const json = await res.json()

    if (json.redirect === 'super-admin') {
      router.push('/super-admin')
      router.refresh()
      return
    }

    // json.groups contains the user's groups (may be empty)
    const userGroups: Group[] = json.groups || []

    if (userGroups.length === 0) {
      setError('您尚未加入任何团队，请联系管理员。')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (userGroups.length === 1) {
      doSelectGroup(userGroups[0])
      return
    }

    // Multiple groups — show picker
    setGroups(userGroups)
    setLoading(false)
    setStep('group')
  }

  function doSelectGroup(group: Group) {
    document.cookie = `qt_group=${group.id}; path=/; max-age=86400; SameSite=Lax`
    if (group.subdomain) {
      router.push(`/${group.subdomain}/projects`)
    } else {
      router.push('/projects')
    }
    router.refresh()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  /* ── Group picker step ──────────────────────────────────── */
  if (step === 'group') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
              <span className="text-white text-2xl font-bold">Q</span>
            </div>
            <h1 className="text-white text-2xl font-semibold">选择团队</h1>
            <p className="text-slate-400 text-sm mt-1">您属于多个团队，请选择要进入的团队</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-3">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => doSelectGroup(g)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200
                           hover:border-teal-500 hover:bg-teal-50 transition-all duration-150 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-teal-700">{g.name}</div>
                    {g.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{g.description}</div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3
                    ${g.role === 'first_admin' ? 'bg-purple-100 text-purple-700'
                    : g.role === 'second_admin' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'}`}>
                    {g.role === 'first_admin' ? '一级管理员'
                      : g.role === 'second_admin' ? '二级管理员'
                      : '成员'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-slate-500 text-xs mt-6">
            选择后可在侧边栏切换团队。
          </p>
        </div>
      </div>
    )
  }

  /* ── Login step ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 mb-4">
            <span className="text-white text-2xl font-bold">Q</span>
          </div>
          <h1 className="text-white text-2xl font-semibold">趋境团</h1>
          <p className="text-slate-400 text-sm mt-1">请使用邮箱账号登录</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="your@email.com"
                autoFocus
                autoComplete="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                           placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入密码"
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                           placeholder:text-gray-400"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400
                         text-white font-medium py-2.5 rounded-lg transition-colors duration-150
                         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          账号由管理员创建，如需帮助请联系管理员。
        </p>
      </div>
    </div>
  )
}
