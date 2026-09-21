import { divIcon } from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker } from 'react-leaflet'
import type { Stop } from '../types/transit'
import { getStopTransportKind } from '../utils/schedule'

type StopMarkerProps = {
  stop: Stop
  detailed: boolean
  selected: boolean
  onSelect: (stopId: string) => void
}

export const StopMarker = memo(function StopMarker({
  stop,
  detailed,
  selected,
  onSelect,
}: StopMarkerProps) {
  const kind = getStopTransportKind(stop)
  const label = `${getStopKindLabel(kind)} ${stop.name}`
  const icon = useMemo(
    () =>
      divIcon({
        className: 'setram-stop-icon',
        html: `<span class="setram-stop-dot setram-stop-dot--${kind} ${
          detailed ? 'setram-stop-dot--detailed' : ''
        } ${selected ? 'setram-stop-dot--selected' : ''}"></span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    [detailed, kind, selected],
  )
  const eventHandlers = useMemo(
    () => ({
      click: () => onSelect(stop.id),
    }),
    [onSelect, stop.id],
  )

  return (
    <Marker
      position={[stop.lat, stop.lng]}
      icon={icon}
      eventHandlers={eventHandlers}
      title={label}
      alt={label}
      keyboard
      riseOnHover
      zIndexOffset={selected ? 500 : 0}
    />
  )
})

function getStopKindLabel(kind: ReturnType<typeof getStopTransportKind>) {
  if (kind === 'tram') {
    return 'Arrêt tram'
  }

  if (kind === 'mixed') {
    return 'Arrêt bus et tram'
  }

  if (kind === 'bus') {
    return 'Arrêt bus'
  }

  return 'Arrêt'
}
