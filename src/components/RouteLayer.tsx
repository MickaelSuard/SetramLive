import type { LatLngExpression, Renderer } from 'leaflet'
import { memo, useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import type { Route, Shape } from '../types/transit'

type RouteLayerProps = {
  shapes: Shape[]
  routesById?: Record<string, Route>
  renderer: Renderer
  selectedRouteId: string | null
}

type RouteGeometry = {
  routeId: string
  positions: LatLngExpression[][]
}

export const RouteLayer = memo(function RouteLayer({
  shapes,
  routesById,
  renderer,
  selectedRouteId,
}: RouteLayerProps) {
  const geometries = useMemo(() => {
    const grouped = new Map<string, LatLngExpression[][]>()

    for (const shape of shapes) {
      const routeShapes = grouped.get(shape.routeId)
      const positions = shape.points.map((point) => [point.lat, point.lng] satisfies LatLngExpression)

      if (routeShapes) {
        routeShapes.push(positions)
      } else {
        grouped.set(shape.routeId, [positions])
      }
    }

    return Array.from(grouped, ([routeId, positions]): RouteGeometry => ({ routeId, positions }))
  }, [shapes])

  return geometries.map(({ routeId, positions }) => {
    const route = routesById?.[routeId]

    return (
      <Polyline
        key={routeId}
        positions={positions}
        renderer={renderer}
        interactive={false}
        pathOptions={{
          color: route?.color ?? '#dc2626',
          opacity: selectedRouteId ? 0.9 : 0.34,
          weight: selectedRouteId ? 5 : 2.5,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    )
  })
})
