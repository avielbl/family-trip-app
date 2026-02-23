import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{ fontSize: '56px' }}>🇬🇷</div>
          <h2 style={{ color: '#1e40af', fontSize: '20px', fontWeight: 700 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '300px', lineHeight: 1.5 }}>
            {this.state.error.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #1e40af, #2563eb)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Remove the HTML fallback — React is about to take over
const jsFallback = document.getElementById('js-fallback');
if (jsFallback) jsFallback.remove();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
