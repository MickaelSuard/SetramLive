import { memo } from 'react'
import type { Vehicle } from '../types/transit'
import type { Point } from '../utils/geo'
import { formatDirection, getVehicleEmoji } from '../utils/vehicle'

type BusMarkerProps = {
  vehicle: Vehicle
  point: Point
  selected: boolean
  onSelect: (vehicleId: string) => void
}

export const BusMarker = memo(function BusMarker({ vehicle, point, selected, onSelect }: BusMarkerProps) {
  const routeLabel = vehicle.route?.shortName ?? vehicle.routeId ?? vehicle.label

  return (
    <button
      type="button"
      title={`${getVehicleEmoji(vehicle)} ${routeLabel} · ${formatDirection(vehicle)} · Véhicule ${vehicle.label}`}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(vehicle.id)
      }}
      className={`absolute z-30 flex h-14 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center bg-transparent transition hover:scale-110 focus:outline-none ${
        selected ? 'scale-110' : ''
      }`}
      style={{
        left: point.x,
        top: point.y,
      }}
    >
      <span className="text-xl leading-none" aria-hidden="true">
        {getVehicleEmoji(vehicle)}
      </span>
      <span
        className="mt-1 flex h-5 max-w-12 items-center justify-center truncate rounded px-1.5 text-[11px] font-black leading-none"
        style={{
          backgroundColor: vehicle.route?.color ?? '#dc2626',
          color: vehicle.route?.textColor ?? '#ffffff',
        }}
      >
        {routeLabel}
      </span>
    </button>
  )
})
