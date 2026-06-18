import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="min-h-full text-zinc-100">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Echostash</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              dev
            </span>
          </Link>
          <span className="text-sm text-zinc-500">prompt change intelligence</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
