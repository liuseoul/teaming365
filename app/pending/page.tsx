'use client'
import { useState } from 'react'
import { useClerk, useAuth } from '@clerk/nextjs'

function BrandName() {
  return (
    <span className="text-2xl font-semibold">
      团队<span
        className="font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent"
        style={{ fontVariantNumeric: 'oldstyle-nums' }}
      >365</span>
    </span>
  )
}

export default function PendingPage() {
  const { signOut } = useClerk()
  const { userId } = useAuth()

  // ── Create-team inline form state ─────────────────────────
  const [showCreate,     setShowCreate]     = useState(false)
  const [groupNameCn,    setGroupNameCn]    = useState('')
  const [groupNameEn,    setGroupNameEn]    = useState('')
  const [managerNameEn,  setManagerNameEn]  = useState('')
  const [creating,       setCreating]       = useState(false)
  const [createMsg,      setCreateMsg]      = useState('')

  const previewSubdomain = (groupNameEn + managerNameEn)
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)

  async function handleCreate() {
    if (!groupNameCn.trim() || !groupNameEn.trim() || !managerNameEn.trim()) {
      setCreateMsg('❌ 请填写所有字段'); return
    }
    if (!userId) { setCreateMsg('❌ 未检测到登录状态，请刷新后重试'); return }
    setCreating(true); setCreateMsg('')
    try {
      const res = await fetch('/api/auth/create-group-for-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId:   userId,
          groupNameCn:   groupNameCn.trim(),
          groupNameEn:   groupNameEn.trim(),
          managerNameEn: managerNameEn.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setCreateMsg(`❌ ${json.error || '创建失败'}`); return }
      window.location.href = `/${json.subdomain}/projects`
    } catch {
      setCreateMsg('❌ 网络错误，请重试')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-600/20 border border-teal-500/30 mb-6">
          <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
        </div>

        {/* Brand */}
        <h1 className="text-white mb-1"><BrandName /></h1>

        {!showCreate ? (
          /* ── Waiting card ──────────────────────────────── */
          <div className="bg-white rounded-2xl shadow-2xl p-8 mt-6 space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 border border-amber-200 mx-auto">
              <span className="text-xl">⏳</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">注册成功，等待分配</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              您的账号已创建。如果您受邀加入某个团队，请联系管理员通过邮箱将您加入；加入后即可访问案件工作台。
            </p>
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-400 text-left space-y-1">
              <p>✉️ 将您的注册邮箱发给团队负责人</p>
              <p>🔑 负责人可直接通过邮箱将您加入团队</p>
              <p>✅ 加入后用同一账号密码登录即可</p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 text-gray-300">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">或者</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Create team option */}
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-2.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            >
              创建我自己的团队 →
            </button>

            <button
              onClick={() => signOut({ redirectUrl: '/login' })}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              退出登录
            </button>
          </div>
        ) : (
          /* ── Create team card ──────────────────────────── */
          <div className="bg-white rounded-2xl shadow-2xl p-8 mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">创建我的团队</h2>
            <p className="text-sm text-gray-500">创建后您将成为团队负责人，可邀请成员加入。</p>

            <div className="space-y-3 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">团队名称（中文）<span className="text-red-500">*</span></label>
                <input type="text" value={groupNameCn} onChange={e => setGroupNameCn(e.target.value)}
                  placeholder="如：趋境律师事务所"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">团队名称（英文）<span className="text-red-500">*</span></label>
                <input type="text" value={groupNameEn} onChange={e => setGroupNameEn(e.target.value)}
                  placeholder="如：QujingLaw"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">您的英文名<span className="text-red-500">*</span></label>
                <input type="text" value={managerNameEn} onChange={e => setManagerNameEn(e.target.value)}
                  placeholder="如：ZhangSan"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-gray-400" />
              </div>

              {previewSubdomain && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 text-xs text-gray-600">
                  团队访问路径：<span className="font-mono font-semibold text-teal-700">teaming365.com/{previewSubdomain}</span>
                </div>
              )}
            </div>

            {createMsg && <p className="text-sm text-red-600 text-left">{createMsg}</p>}

            <button onClick={handleCreate} disabled={creating}
              className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors">
              {creating ? '创建中…' : '创建团队'}
            </button>
            <button onClick={() => { setShowCreate(false); setCreateMsg('') }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← 返回
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
