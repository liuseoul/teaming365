'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs/legacy'

function generatePassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$%&*'
  const all     = upper + lower + digits + special

  const rand = (s: string) => s[Math.floor(Math.random() * s.length)]
  // Guaranteed components
  const mandatory = [rand(lower), rand(digits), rand(special)]
  // Fill to 10 chars
  const filler = Array.from({ length: 6 }, () => rand(all))
  const rest = [...mandatory, ...filler]
  // Fisher-Yates shuffle
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return rand(upper) + rest.join('') // Always starts with uppercase letter
}

function buildSubdomain(firmEN: string, managerEN: string): string {
  return (firmEN + managerEN).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
}

export default function SuperAdminDashboard({
  profile,
  groups,
}: {
  profile: { id: string; name: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groups: any[]
}) {
  const router = useRouter()
  const { signOut } = useClerk()

  // ── Tab state ───────────────────────────────────────────────
  const [tab, setTab] = useState<'create' | 'stats'>('create')

  // ── Create group form state ─────────────────────────────────
  const [firmCn,    setFirmCn]    = useState('')
  const [firmEn,    setFirmEn]    = useState('')
  const [mgrCn,     setMgrCn]     = useState('')
  const [mgrEn,     setMgrEn]     = useState('')
  const [mgrEmail,  setMgrEmail]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')

  // ── Password reset state ────────────────────────────────────
  const [resetGroupId,  setResetGroupId]  = useState('')
  const [resetAdminId,  setResetAdminId]  = useState('')
  const [resetPwd,      setResetPwd]      = useState('')
  const [showResetPwd,  setShowResetPwd]  = useState(false)
  const [resetSaving,   setResetSaving]   = useState(false)
  const [resetMsg,      setResetMsg]      = useState('')

  const previewSubdomain = buildSubdomain(firmEn, mgrEn)

  function handleGenPwd() {
    const p = generatePassword()
    setPassword(p)
    setShowPwd(true)
  }

  async function handleCreate() {
    setMsg('')
    if (!firmCn.trim() || !firmEn.trim() || !mgrCn.trim() || !mgrEn.trim() || !mgrEmail.trim() || !password) {
      setMsg('❌ 所有字段均为必填')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/create-group-with-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerUserId: profile.id,
          firmNameCn: firmCn.trim(),
          firmNameEn: firmEn.trim(),
          managerNameCn: mgrCn.trim(),
          managerNameEn: mgrEn.trim(),
          managerEmail: mgrEmail.trim(),
          password,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(`❌ ${json.error || '创建失败'}`)
      } else {
        setMsg(`✅ 团队已创建，子路径：/${json.subdomain}`)
        setFirmCn(''); setFirmEn(''); setMgrCn(''); setMgrEn('')
        setMgrEmail(''); setPassword(''); setShowPwd(false)
        setTimeout(() => router.refresh(), 800)
      }
    } catch {
      setMsg('❌ 网络错误，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPwd() {
    setResetMsg('')
    if (!resetAdminId || !resetPwd) {
      setResetMsg('❌ 请选择团队并填写新密码')
      return
    }
    setResetSaving(true)
    try {
      const res = await fetch('/api/super-admin/reset-first-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerUserId: profile.id, adminUserId: resetAdminId, newPassword: resetPwd }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResetMsg(`❌ ${json.error || '操作失败'}`)
      } else {
        setResetMsg('✅ 密码已重置')
        setResetGroupId(''); setResetAdminId(''); setResetPwd(''); setShowResetPwd(false)
      }
    } catch {
      setResetMsg('❌ 网络错误，请重试')
    } finally {
      setResetSaving(false)
    }
  }

  function handleGroupSelect(gid: string) {
    setResetGroupId(gid)
    // Find first-admin of this group
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = groups.find((x: any) => x.id === gid)
    if (g?.group_members?.[0]?.user_id) {
      setResetAdminId(g.group_members[0].user_id)
    } else {
      setResetAdminId('')
    }
    setResetMsg('')
  }

  async function handleLogout() {
    document.cookie = 'qt_group=; path=/; max-age=0'
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-sm font-bold text-white">Q</div>
          <div>
            <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
              团队<span className="font-black bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent" style={{fontVariantNumeric:'oldstyle-nums'}}>365</span>
              <span className="text-gray-400 font-normal ml-1">· 超级管理员</span>
            </div>
            <div className="text-xs text-gray-400">{profile.name}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          退出登录
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {(['create', 'stats'] as const).map(key => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${tab === key ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {key === 'create' ? '创建新团队' : '团队统计'}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {tab === 'create' && (
          <>
            {/* ── Create Group + First-Admin ──────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">创建团队及负责人</h2>
              <p className="text-xs text-gray-500 mb-5">创建后，负责人可通过其邮箱和初始密码登录，访问路径为 teaming365.com/<span className="font-mono text-teal-600">{previewSubdomain || '…'}</span></p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">公司名（中文）*</label>
                  <input value={firmCn} onChange={e => setFirmCn(e.target.value)}
                    placeholder="趋境（北京）科技有限公司" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">公司名（英文）*</label>
                  <input value={firmEn} onChange={e => setFirmEn(e.target.value)}
                    placeholder="QuJing Technology" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">负责人姓名（中文）*</label>
                  <input value={mgrCn} onChange={e => setMgrCn(e.target.value)}
                    placeholder="张三" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">负责人姓名（英文）*</label>
                  <input value={mgrEn} onChange={e => setMgrEn(e.target.value)}
                    placeholder="ZhangSan" className="input-field" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">负责人邮箱（登录账号）*</label>
                  <input type="email" value={mgrEmail} onChange={e => setMgrEmail(e.target.value)}
                    placeholder="zhangsan@example.com" className="input-field" />
                </div>

                {/* Subdomain preview */}
                {previewSubdomain && (
                  <div className="col-span-2">
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
                      团队访问路径：<span className="font-mono font-semibold text-teal-700">teaming365.com/{previewSubdomain}</span>
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">初始密码 *</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="至少 8 位，含大小写字母、数字和特殊字符"
                        className="input-field pr-16"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">
                        {showPwd ? '隐藏' : '显示'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenPwd}
                      className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors whitespace-nowrap font-medium">
                      自动生成
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">规则：8位以上，以字母开头，须含大写字母、小写字母、数字、特殊字符各至少一个</p>
                </div>
              </div>

              {msg && <p className="mt-3 text-sm">{msg}</p>}
              <button onClick={handleCreate} disabled={saving} className="mt-4 btn-primary">
                {saving ? '创建中…' : '创建团队'}
              </button>
            </section>

            {/* ── Password Reset ──────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">重置负责人密码</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">选择团队</label>
                  <select value={resetGroupId} onChange={e => handleGroupSelect(e.target.value)} className="input-field">
                    <option value="">— 请选择团队 —</option>
                    {groups.map((g: any) => (
                      <option key={g.id} value={g.id}>{g.firm_name_cn || g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">新密码</label>
                  <div className="relative">
                    <input
                      type={showResetPwd ? 'text' : 'password'}
                      value={resetPwd}
                      onChange={e => setResetPwd(e.target.value)}
                      placeholder="至少 8 位"
                      className="input-field pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700">
                      {showResetPwd ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>
              </div>
              {resetMsg && <p className="mt-3 text-sm">{resetMsg}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={handleResetPwd} disabled={resetSaving} className="btn-primary">
                  {resetSaving ? '处理中…' : '重置密码'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = generatePassword()
                    setResetPwd(p)
                    setShowResetPwd(true)
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium">
                  自动生成密码
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'stats' && (
          /* ── Group List ──────────────────────────────────────── */
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              所有团队 <span className="text-gray-400 font-normal text-sm">（{groups.length} 个）</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 text-xs font-medium text-gray-500">公司名</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">负责人</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">邮箱</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">访问路径</th>
                    <th className="pb-2 text-xs font-medium text-gray-500 text-right">成员数</th>
                    <th className="pb-2 text-xs font-medium text-gray-500 text-right">案件数</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g: any) => {
                    const admin = g.group_members?.[0]
                    return (
                      <tr key={g.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 font-medium text-gray-900">
                          <div>{g.firm_name_cn || g.name}</div>
                          {g.firm_name_en && <div className="text-xs text-gray-400">{g.firm_name_en}</div>}
                        </td>
                        <td className="py-3 text-gray-700">
                          <div>{g.manager_name_cn || admin?.profiles?.name || '—'}</div>
                          {g.manager_name_en && <div className="text-xs text-gray-400">{g.manager_name_en}</div>}
                        </td>
                        <td className="py-3 text-gray-500 text-xs">{admin?.profiles?.email || '—'}</td>
                        <td className="py-3">
                          {g.subdomain
                            ? <span className="font-mono text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded">/{g.subdomain}</span>
                            : <span className="text-gray-400 text-xs">—</span>
                          }
                        </td>
                        <td className="py-3 text-gray-700 text-sm text-right">{g.memberCount}</td>
                        <td className="py-3 text-gray-700 text-sm text-right">{g.projectCount}</td>
                        <td className="py-3 text-gray-400 text-xs">
                          {new Date(g.created_at).toLocaleDateString('zh-CN')}
                        </td>
                      </tr>
                    )
                  })}
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">暂无团队</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
