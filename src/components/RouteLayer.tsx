import { memo } from 'react'
import type { Route, Shape } from '../types/transit'
import type { Point } from '../utils/geo'

type RouteLayerProps = {
  shapes: Shape[]
  routesById?: Record<string, Route>
  project: (point: { lat: number; lng: number }) => Point
  selectedRouteId: string | null
}

export const RouteLayer = memo(function RouteLayer({ shapes, routesById, project, selectedRouteId }: RouteLayerProps) {
  return (
    <g>
      {shapes.map((shape) => {
        const route = routesById?.[shape.routeId]
        const points = shape.points
          .map(project)
          .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
          .join(' ')

        return (
          <polyline
            key={shape.id}
            points={points}
            fill="none"
            stroke={route?.color ?? '#dc2626'}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={selectedRouteId ? 0.9 : 0.34}
            strokeWidth={selectedRouteId ? 5 : 2.5}
          />
        )
      })}
    </g>
  )
})
