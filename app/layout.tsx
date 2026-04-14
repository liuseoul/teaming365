import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '趋境团 | 项目管理',
  description: '多团队项目管理平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
