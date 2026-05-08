import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { registerNotificationServiceWorker, restoreScheduledNotifications } from './lib/notifications'

void registerNotificationServiceWorker().then(() => restoreScheduledNotifications())

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
)
