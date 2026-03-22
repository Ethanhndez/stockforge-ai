// src/components/Navbar.tsx
export default function Navbar() {
  return (
    <nav style={{ borderBottom: '1px solid var(--border)', padding: '12px 24px' }}>
      <a href="/" style={{ fontWeight: 700, textDecoration: 'none', color: 'var(--text)' }}>
        StockForge AI
      </a>
    </nav>
  )
}
