import { useLocation, Link } from 'react-router'
import { Home, History, Settings } from 'lucide-react'
import { useAppContext } from '@/contexts/AppContext'

const tabs = [
  { path: '/', label: '홈', icon: Home },
  { path: '/history', label: '기록', icon: History },
  { path: '/settings', label: '설정', icon: Settings },
]

const loggedOutTabs = [
  { path: '/', label: '홈', icon: Home },
  { path: '/settings', label: '설정', icon: Settings },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const { isLoggedIn } = useAppContext()

  const visibleTabs = isLoggedIn ? tabs : loggedOutTabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-smart-border safe-bottom">
      <div className="max-w-[430px] mx-auto h-16 flex items-center justify-around">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.path
          const Icon = tab.icon
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-transform active:scale-[0.92] ${
                active ? 'text-smart-primary' : 'text-smart-text-muted'
              }`}
            >
              <Icon
                className="w-6 h-6"
                strokeWidth={active ? 2.5 : 1.5}
                fill={active ? 'currentColor' : 'none'}
              />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
