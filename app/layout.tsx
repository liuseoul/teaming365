export const runtime = 'edge'

import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs/legacy'
import './globals.css'

export const metadata: Metadata = {
  title: '团队365 | 案件管理',
  description: '多团队案件管理平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="zh-CN">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
