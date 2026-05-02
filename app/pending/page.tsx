'use client'
import { useClerk } from '@clerk/nextjs'

export default function PendingPage() {
  const { signOut } = useClerk()

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
        <h1 className="text-white text-2xl font-semibold mb-1">
          团队<span
            className="font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent"
            style={{ fontVariantNumeric: 'oldstyle-nums' }}
          >365</span>
        </h1>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mt-6 space-y-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 border border-amber-200 mx-auto">
            <span className="text-xl">⏳</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">注册成功，等待分配</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            您的账号已创建。请联系管理员将您加入团队，加入后即可访问案件工作台。
          </p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-400 text-left space-y-1">
            <p>✉️ 可将您的注册邮箱发送给管理员</p>
            <p>🔑 管理员会将您加入对应团队</p>
            <p>✅ 加入后用同一邮箱密码登录即可</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: '/login' })}
            className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
          >
            返回登录页
          </button>
        </div>

      </div>
    </div>
  )
}
