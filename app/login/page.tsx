'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Group = { id: string; name: string; description: string; role: string }

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep]       = useState<'login' | 'group'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [groups,   setGroups]   = useState<Group[]>([])

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError('请输入用户名和密码。')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const domain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'company.internal'
    const email = `${username.trim()}@${domain}`

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('用户名或密码错误，请联系管理员。')
      setLoading(false)
      return
    }

    // Fetch groups the user belongs to
    const { data: membership } = await supabase
      .from('group_members')
      .select('role, groups(id, name, description)')
      .order('created_at', { ascending: true })

    const userGroups: Group[] = (membership || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        id:          m.groups?.id          || '',
        name:        m.groups?.name        || '',
        description: m.groups?.description || '',
        role:        m.role,
      }))
      .filter(g => g.id)

    if (userGroups.length === 0) {
      setError('您尚未加入任何团队，请联系管理员。')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (userGroups.length === 1) {
      doSelectGroup(userGroups[0].id)
      return
    }

    // Multiple groups — show picker
    setGroups(userGroups)
    setLoading(false)
    setStep('group')
  }

  function doSelectGroup(groupId: string) {
    document.cookie = `qt_group=${groupId}; path=/; max-age=86400; SameSite=Lax`
    router.push('/projects')
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
                onClick={() => doSelectGroup(g.id)}
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
                    ${g.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {g.role === 'admin' ? '管理员' : '成员'}
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
          <p className="text-slate-400 text-sm mt-1">使用内部账号登录</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入用户名"
                autoFocus
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
