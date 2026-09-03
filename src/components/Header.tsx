import { Activity, BusFront, Clock, RefreshCw } from 'lucide-react'
import { formatAge, formatClock } from '../utils/time'

type HeaderProps = {
  vehicleCount: number
  feedTimestamp?: number
  isRefreshing: boolean
  hasError: boolean
}

export function Header({ vehicleCount, feedTimestamp, isRefreshing, hasError }: HeaderProps) {
  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-600 text-white shadow-lg shadow-red-950/30">
          <BusFront className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal">SETRAM Live</h1>
          <p className="truncate text-sm text-zinc-400">Bus et tramways en temps réel au Mans</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200">
          <Activity className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          {vehicleCount} véhicules
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 ${
            hasError
              ? 'border-rose-500/40 bg-rose-950/50 text-rose-100'
              : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-100'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {hasError ? 'Flux a verifier' : 'Flux actif'}
        </span>
        <span className="hidden items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-300 sm:inline-flex">
          <Clock className="h-4 w-4 text-sky-300" aria-hidden="true" />
          {formatClock(feedTimestamp)} · {formatAge(feedTimestamp)}
        </span>
      </div>
    </header>
  )
}
