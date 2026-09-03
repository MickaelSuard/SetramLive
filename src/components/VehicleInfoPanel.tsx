import { Compass, Gauge, MapPin, Signal, X } from 'lucide-react'
import type { Vehicle } from '../types/transit'
import { formatAge, formatClock, formatSpeed } from '../utils/time'
import { formatDirection, getVehicleEmoji } from '../utils/vehicle'
import { RouteBadge } from './RouteBadge'

type VehicleInfoPanelProps = {
  vehicle: Vehicle
  onClose: () => void
}

export function VehicleInfoPanel({ vehicle, onClose }: VehicleInfoPanelProps) {
  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="absolute bottom-2 left-2 right-2 z-50 rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-zinc-100 shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:w-80 sm:p-3"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none sm:text-2xl" aria-hidden="true">
          {getVehicleEmoji(vehicle)}
        </span>
        <RouteBadge route={vehicle.route} fallback={vehicle.routeId ?? 'Bus'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold sm:text-base">Véhicule {vehicle.label}</h2>
              <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-zinc-400 sm:line-clamp-2 sm:text-sm">
                {vehicle.route?.longName ?? 'Ligne non renseignée'}
              </p>
            </div>
            <button
              type="button"
              title="Fermer"
              aria-label="Fermer la fiche véhicule"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:mt-3 sm:text-sm">
        <InfoItem icon={Compass} label="Sens" value={formatDirection(vehicle)} />
        <InfoItem icon={Gauge} label="Vitesse" value={formatSpeed(vehicle.speed)} />
        <InfoItem icon={Signal} label="Signal" value={`${formatClock(vehicle.timestamp)} · ${formatAge(vehicle.timestamp)}`} />
        <InfoItem icon={MapPin} label="Arrêt proche" value={vehicle.stopName ?? 'Arrêt inconnu'} />
      </div>

      <div className="mt-2 hidden rounded-md bg-zinc-900 px-2 py-1.5 text-xs text-zinc-400 sm:block">
        {vehicle.lat.toFixed(5)}, {vehicle.lng.toFixed(5)}
      </div>
    </div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Compass
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-md bg-zinc-900 p-2">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="truncate text-zinc-100">{value}</div>
    </div>
  )
}
