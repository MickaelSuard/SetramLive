import { divIcon } from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker } from 'react-leaflet'
import type { Vehicle } from '../types/transit'
import { formatDirection, getVehicleEmoji } from '../utils/vehicle'

type BusMarkerProps = {
  vehicle: Vehicle
  selected: boolean
  onSelect: (vehicleId: string) => void
}

export const BusMarker = memo(function BusMarker({ vehicle, selected, onSelect }: BusMarkerProps) {
  const routeLabel = vehicle.route?.shortName ?? vehicle.routeId ?? vehicle.label
  const title = `${getVehicleEmoji(vehicle)} ${routeLabel} · ${formatDirection(vehicle)} · Véhicule ${vehicle.label}`
  const icon = useMemo(
    () =>
      divIcon({
        className: 'setram-vehicle-icon',
        html: `<span class="setram-vehicle-marker ${selected ? 'setram-vehicle-marker--selected' : ''}">
          <span class="setram-vehicle-emoji">${getVehicleEmoji(vehicle)}</span>
          <span class="setram-vehicle-route" style="background:${escapeHtml(
            vehicle.route?.color ?? '#dc2626',
          )};color:${escapeHtml(vehicle.route?.textColor ?? '#ffffff')}">${escapeHtml(routeLabel)}</span>
        </span>`,
        iconSize: [52, 58],
        iconAnchor: [26, 29],
      }),
    [routeLabel, selected, vehicle],
  )
  const eventHandlers = useMemo(
    () => ({
      click: () => onSelect(vehicle.id),
    }),
    [onSelect, vehicle.id],
  )

  return (
    <Marker
      position={[vehicle.lat, vehicle.lng]}
      icon={icon}
      eventHandlers={eventHandlers}
      title={title}
      alt={title}
      keyboard
      riseOnHover
      zIndexOffset={selected ? 1000 : 500}
    />
  )
})

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  )
}
