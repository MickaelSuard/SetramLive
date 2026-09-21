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
    <header className="hidden shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 sm:flex sm:min-h-16 sm:flex-wrap lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-600 text-white shadow-lg shadow-red-950/30 sm:h-11 sm:w-11">
          <BusFront className="h-4 w-4 sm:h-6 sm:w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-normal sm:text-xl">SETRAM Live</h1>
          <p className="hidden truncate text-sm text-zinc-400 sm:block">Bus et tramways en temps réel au Mans</p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 text-xs sm:flex-wrap sm:gap-2 sm:text-sm">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-zinc-200 sm:h-auto sm:gap-2 sm:px-3 sm:py-2">
          <Activity className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span>{vehicleCount}</span>
          <span className="hidden sm:inline">véhicules</span>
        </span>
        <span
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 sm:h-auto sm:gap-2 sm:px-3 sm:py-2 ${
            hasError
              ? 'border-rose-500/40 bg-rose-950/50 text-rose-100'
              : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-100'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span className="hidden sm:inline">{hasError ? 'Flux à vérifier' : 'Flux actif'}</span>
        </span>
        <span className="hidden items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-300 md:inline-flex">
          <Clock className="h-4 w-4 text-sky-300" aria-hidden="true" />
          {formatClock(feedTimestamp)} · {formatAge(feedTimestamp)}
        </span>
      </div>
    </header>
  )
}
