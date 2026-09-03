import { Compass, Gauge, MapPin, Navigation } from 'lucide-react'
import { memo } from 'react'
import type { Vehicle } from '../types/transit'
import { formatAge, formatSpeed } from '../utils/time'
import { formatDirection, getVehicleEmoji } from '../utils/vehicle'
import { RouteBadge } from './RouteBadge'

type VehicleCardProps = {
  vehicle: Vehicle
  selected: boolean
  onSelect: (vehicleId: string) => void
}

export const VehicleCard = memo(function VehicleCard({ vehicle, selected, onSelect }: VehicleCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(vehicle.id)}
      className={`w-full rounded-md border p-2.5 text-left transition sm:p-3 ${
        selected
          ? 'border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-950/20'
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-lg leading-none sm:text-xl" aria-hidden="true">
            {getVehicleEmoji(vehicle)}
          </span>
          <RouteBadge route={vehicle.route} fallback={vehicle.routeId ?? 'Bus'} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100 sm:text-base">Véhicule {vehicle.label}</div>
            <div className="truncate text-xs text-zinc-400 sm:text-sm">{vehicle.route?.longName ?? 'Ligne non renseignée'}</div>
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-950 px-2 py-1 text-xs text-zinc-400">{formatAge(vehicle.timestamp)}</span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400 sm:hidden">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <Compass className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
          {formatDirection(vehicle)}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <Gauge className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          {formatSpeed(vehicle.speed)}
        </span>
      </div>

      <div className="mt-3 hidden grid-cols-2 gap-2 text-xs text-zinc-400 sm:grid">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <Navigation className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
          {vehicle.status}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <Compass className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
          {formatDirection(vehicle)}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <Gauge className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          {formatSpeed(vehicle.speed)}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <MapPin className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
          {vehicle.stopName ?? 'Arrêt inconnu'}
        </span>
      </div>
    </button>
  )
})
