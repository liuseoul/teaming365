'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'

export default function ProjectsRedirect() {
  const { userId, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      window.location.href = '/login'
      return
    }

    fetch('/api/auth/get-redirect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then(r => r.json())
      .then(({ url }) => { window.location.href = url || '/login' })
      .catch(() => { window.location.href = '/login' })
  }, [isLoaded, userId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center">
      <div className="text-white text-lg tracking-wide">正在跳转…</div>
    </div>
  )
}
