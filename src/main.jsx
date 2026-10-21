import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AccessibilityProvider from './a11y/AccessibilityProvider.jsx'
import AccountProvider from './banking/AccountProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccessibilityProvider>
            <AccountProvider>
        <App />
      </AccountProvider>
    </AccessibilityProvider>
  </StrictMode>,
)