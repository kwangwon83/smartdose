import type { ReactNode } from 'react'
import Header from './Header'
import Navbar from './Navbar'

interface LayoutProps {
  children: ReactNode
  showNav?: boolean
  showHeader?: boolean
}

export default function Layout({ children, showNav = true, showHeader = true }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-smart-bg">
      {showHeader && <Header />}
      <main className={`flex-1 ${showNav ? 'pb-20' : ''}`}>{children}</main>
      {showNav && <Navbar />}
    </div>
  )
}
