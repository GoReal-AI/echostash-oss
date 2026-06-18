import type { CSSProperties } from 'react'

const shell: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  background: '#0a0a0b',
  color: '#e4e4e7',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}

export function App() {
  return (
    <div style={shell}>
      <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '-0.02em' }}>Echostash</h1>
      <p style={{ margin: 0, color: '#a1a1aa', maxWidth: 460, textAlign: 'center' }}>
        Agentless prompt change intelligence + eval. The UI lands in milestone&nbsp;M3 — registry,
        change timeline, sandbox, and the eval matrix.
      </p>
    </div>
  )
}
