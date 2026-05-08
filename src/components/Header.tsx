import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Bell, LogIn } from 'lucide-react'
import { useAppContext } from '@/contexts/AppContext'

export default function Header() {
  const { isLoggedIn } = useAppContext()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 h-14 flex items-center justify-between px-5 bg-white/90 backdrop-blur-md transition-shadow duration-200 ${
        scrolled ? 'shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : ''
      }`}
      style={{ borderBottom: '1px solid #E2E8F0' }}
    >
      <Link to="/" className="flex items-center gap-2">
        <img src="/logo.svg" alt="SmartDose" className="w-8 h-8" />
        <span className="text-sm font-semibold text-smart-text">SmartDose</span>
      </Link>
      <div>
        {isLoggedIn ? (
          <button className="p-2 rounded-full hover:bg-gray-100 active:scale-95 transition-transform">
            <Bell className="w-5 h-5 text-smart-text-secondary" />
          </button>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-smart-primary text-white text-sm font-medium hover:bg-smart-primary-dark active:scale-95 transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>로그인</span>
          </Link>
        )}
      </div>
    </header>
  )
}
