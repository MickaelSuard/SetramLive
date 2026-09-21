import { latLngBounds } from 'leaflet'
import type { LatLngExpression, Renderer } from 'leaflet'
import { useEffect, useMemo } from 'react'
import { Circle, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet'
import type { LatLng, Shape, StaticNetwork } from '../types/transit'
import type { JourneyPlan } from '../utils/journey'
import type { JourneyLocation } from '../utils/journey'

type JourneyLayerProps = {
  plan: JourneyPlan
  network: StaticNetwork
  renderer: Renderer
}

export function JourneyLayer({ plan, network, renderer }: JourneyLayerProps) {
  const segments = useMemo(
    () =>
      plan.legs.map((leg) => {
        const shape = leg.shapeId
          ? network.shapes.find((candidate) => candidate.id === leg.shapeId)
          : undefined

        return shape ? clipShape(shape, leg.from, leg.to) : [leg.from, leg.to]
      }),
    [network.shapes, plan],
  )

  return (
    <>
      <JourneyFitController plan={plan} segments={segments} />

      <Polyline
        positions={[
          [plan.origin.lat, plan.origin.lng],
          [plan.legs[0].from.lat, plan.legs[0].from.lng],
        ]}
        renderer={renderer}
        interactive={false}
        pathOptions={{ color: '#18181b', weight: 4, opacity: 0.8, dashArray: '5 8' }}
      />

      {segments.map((points, index) => {
        const leg = plan.legs[index]
        const positions = points.map((point) => [point.lat, point.lng] satisfies LatLngExpression)

        return (
          <Polyline
            key={`${leg.tripId}-${index}`}
            positions={positions}
            renderer={renderer}
            interactive={false}
            pathOptions={{
              color: leg.route.color,
              weight: 7,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )
      })}

      <Polyline
        positions={[
          [
            plan.legs.at(-1)?.to.lat ?? plan.destination.lat,
            plan.legs.at(-1)?.to.lng ?? plan.destination.lng,
          ],
          [plan.destination.lat, plan.destination.lng],
        ]}
        renderer={renderer}
        interactive={false}
        pathOptions={{ color: '#18181b', weight: 4, opacity: 0.8, dashArray: '5 8' }}
      />

      {plan.legs.map((leg, index) => (
        <CircleMarker
          key={`stop-${leg.tripId}-${index}`}
          center={[leg.from.lat, leg.from.lng]}
          radius={7}
          renderer={renderer}
          pathOptions={{ color: '#fff', weight: 3, fillColor: leg.route.color, fillOpacity: 1 }}
        >
          <Tooltip direction="top">{leg.from.name}</Tooltip>
        </CircleMarker>
      ))}

      <CircleMarker
        center={[plan.destination.lat, plan.destination.lng]}
        radius={8}
        renderer={renderer}
        pathOptions={{ color: '#fff', weight: 3, fillColor: '#e11d48', fillOpacity: 1 }}
      >
        <Tooltip direction="top">{plan.destination.label}</Tooltip>
      </CircleMarker>
    </>
  )
}

export function UserLocationMarker({
  position,
  renderer,
  recenter,
}: {
  position: JourneyLocation
  renderer: Renderer
  recenter: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (!recenter) {
      return
    }

    map.flyTo([position.lat, position.lng], Math.max(15, map.getZoom()), {
      animate: true,
      duration: 0.4,
    })
  }, [map, position, recenter])

  return (
    <>
      {position.accuracy ? (
        <Circle
          center={[position.lat, position.lng]}
          radius={Math.max(20, position.accuracy)}
          renderer={renderer}
          interactive={false}
          pathOptions={{
            color: '#0284c7',
            weight: 1,
            opacity: 0.45,
            fillColor: '#38bdf8',
            fillOpacity: 0.12,
          }}
        />
      ) : null}
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={8}
        renderer={renderer}
        pathOptions={{ color: '#fff', weight: 3, fillColor: '#0284c7', fillOpacity: 1 }}
      >
        <Tooltip direction="top">
          Votre position · précision ± {formatAccuracy(position.accuracy)}
        </Tooltip>
      </CircleMarker>
    </>
  )
}

function JourneyFitController({ plan, segments }: { plan: JourneyPlan; segments: LatLng[][] }) {
  const map = useMap()

  useEffect(() => {
    const points = [
      plan.origin,
      ...segments.flat(),
      plan.destination,
    ]
    const bounds = latLngBounds(points.map((point) => [point.lat, point.lng]))

    map.fitBounds(bounds, {
      animate: true,
      duration: 0.5,
      maxZoom: 16,
      paddingTopLeft: [36, 88],
      paddingBottomRight: [36, 210],
    })
  }, [map, plan, segments])

  return null
}

function clipShape(shape: Shape, from: LatLng, to: LatLng) {
  const fromIndex = closestPointIndex(shape.points, from)
  const toIndex = closestPointIndex(shape.points, to)

  if (fromIndex <= toIndex) {
    return shape.points.slice(fromIndex, toIndex + 1)
  }

  return shape.points.slice(toIndex, fromIndex + 1).reverse()
}

function closestPointIndex(points: LatLng[], target: LatLng) {
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    const distance = (point.lat - target.lat) ** 2 + (point.lng - target.lng) ** 2

    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  }

  return closestIndex
}

function formatAccuracy(meters = 0) {
  if (meters < 1_000) {
    return `${Math.max(1, Math.round(meters))} m`
  }

  return `${(meters / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
}
