import { LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CENTER } from '../constants/endpoints'
import { useElementSize } from '../hooks/useElementSize'
import type { LatLng, StaticNetwork, Vehicle } from '../types/transit'
import {
  TILE_SIZE,
  boundsIntersect,
  clampZoom,
  createProjector,
  fitViewToPoints,
  getMapBounds,
  getTopLeftWorld,
  getVisibleTiles,
  isPointInBounds,
  isPointOnScreen,
  projectLatLng,
  unprojectPoint,
} from '../utils/geo'
import type { Point } from '../utils/geo'
import { formatAge, formatSpeed } from '../utils/time'
import { formatDirection, getVehicleEmoji } from '../utils/vehicle'
import { BusMarker } from './BusMarker'
import { MapControls } from './MapControls'
import { RouteBadge } from './RouteBadge'
import { RouteLayer } from './RouteLayer'
import { StopMarker } from './StopMarker'

type TransitMapProps = {
  network?: StaticNetwork
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  selectedRouteId: string | null
  showStops: boolean
  showRoutes: boolean
  loading: boolean
  onSelectVehicle: (vehicleId: string) => void
}

type MapView = {
  center: LatLng
  zoom: number
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startZoom: number
  startCenterWorld: Point
  deltaX: number
  deltaY: number
  animationFrame?: number
}

export function TransitMap({
  network,
  vehicles,
  selectedVehicleId,
  selectedRouteId,
  showStops,
  showRoutes,
  loading,
  onSelectVehicle,
}: TransitMapProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [view, setView] = useState<MapView>({ center: DEFAULT_CENTER, zoom: 13 })
  const [isDragging, setIsDragging] = useState(false)
  const mapPaneRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const hasAutoFit = useRef(false)
  const routeFitKey = useRef('')
  const vehicleFitKey = useRef('')
  const tiles = useMemo(() => getVisibleTiles(view.center, view.zoom, size), [size, view.center, view.zoom])
  const project = useMemo(() => createProjector(view.center, view.zoom, size), [size, view.center, view.zoom])
  const bounds = useMemo(() => getMapBounds(view.center, view.zoom, size, 96), [size, view.center, view.zoom])
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId),
    [selectedVehicleId, vehicles],
  )
  const visibleVehiclePoints = useMemo(
    () =>
      vehicles
        .map((vehicle) => ({ vehicle, point: project(vehicle) }))
        .filter(({ point }) => isPointOnScreen(point, size, 110)),
    [project, size, vehicles],
  )
  const visibleStops = useMemo(() => {
    if (!network || !showStops) {
      return []
    }

    const stops = view.zoom >= 16 ? network.stops : network.stationStops
    const limit = view.zoom >= 16 ? 700 : view.zoom >= 14 ? 320 : 180

    return stops
      .filter((stop) => isPointInBounds(stop, bounds))
      .slice(0, limit)
      .map((stop) => ({ stop, point: project(stop) }))
  }, [bounds, network, project, showStops, view.zoom])
  const visibleShapes = useMemo(() => {
    if (!network || !showRoutes) {
      return []
    }

    return network.shapes.filter((shape) => {
      if (selectedRouteId && shape.routeId !== selectedRouteId) {
        return false
      }

      return shape.bounds
        ? boundsIntersect(shape.bounds, bounds)
        : shape.points.some((point) => isPointInBounds(point, bounds))
    })
  }, [bounds, network, selectedRouteId, showRoutes])

  useEffect(() => {
    if (dragRef.current || hasAutoFit.current || !vehicles.length || size.width <= 0 || size.height <= 0) {
      return
    }

    const nextView = fitViewToPoints(vehicles, size, 120)

    if (nextView) {
      // oxlint-disable-next-line react/set-state-in-effect
      setView(nextView)
      hasAutoFit.current = true
    }
  }, [size, vehicles])

  useEffect(() => {
    if (!selectedVehicleId) {
      vehicleFitKey.current = ''
      return
    }

    if (dragRef.current || !selectedVehicle || size.width <= 0 || size.height <= 0) {
      return
    }

    const focusKey = `${selectedVehicle.id}-${size.width}-${size.height}`

    if (focusKey === vehicleFitKey.current) {
      return
    }

    vehicleFitKey.current = focusKey
    // oxlint-disable-next-line react/set-state-in-effect
    setView((current) => ({
      ...current,
      center: selectedVehicle,
    }))
  }, [selectedVehicle, selectedVehicleId, size.height, size.width])

  useEffect(() => {
    if (!selectedRouteId) {
      routeFitKey.current = ''
      return
    }

    if (dragRef.current || size.width <= 0 || size.height <= 0) {
      return
    }

    const focusKey = `${selectedRouteId}-${size.width}-${size.height}-${network?.loadedAt ?? 0}`

    if (focusKey === routeFitKey.current) {
      return
    }

    const routePoints = network?.shapes
      .filter((shape) => shape.routeId === selectedRouteId)
      .flatMap((shape) => shape.points)
    const points = vehicles.length ? vehicles : routePoints ?? []
    const nextView = fitViewToPoints(points, size, 120)

    if (nextView) {
      routeFitKey.current = focusKey
      // oxlint-disable-next-line react/set-state-in-effect
      setView(nextView)
    }
  }, [network, selectedRouteId, size, vehicles])

  const zoomAtCenter = (zoom: number) => {
    setView((current) => ({
      ...current,
      zoom: clampZoom(zoom),
    }))
  }

  const recenter = () => {
    const points = vehicles.length ? vehicles : network?.stationStops ?? []
    const nextView = fitViewToPoints(points, size, 120)

    if (nextView) {
      setView(nextView)
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()

    const nextZoom = clampZoom(view.zoom + (event.deltaY < 0 ? 1 : -1))

    if (nextZoom === view.zoom || size.width <= 0 || size.height <= 0) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const cursor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const topLeft = getTopLeftWorld(view.center, view.zoom, size)
    const cursorWorld = {
      x: topLeft.x + cursor.x,
      y: topLeft.y + cursor.y,
    }
    const cursorLatLng = unprojectPoint(cursorWorld, view.zoom)
    const nextCursorWorld = projectLatLng(cursorLatLng, nextZoom)
    const nextCenterWorld = {
      x: nextCursorWorld.x - (cursor.x - size.width / 2),
      y: nextCursorWorld.y - (cursor.y - size.height / 2),
    }

    setView({
      center: unprojectPoint(nextCenterWorld, nextZoom),
      zoom: nextZoom,
    })
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || size.width <= 0 || size.height <= 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startZoom: view.zoom,
      startCenterWorld: projectLatLng(view.center, view.zoom),
      deltaX: 0,
      deltaY: 0,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current

    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    drag.deltaX = event.clientX - drag.startX
    drag.deltaY = event.clientY - drag.startY

    if (drag.animationFrame) {
      return
    }

    drag.animationFrame = window.requestAnimationFrame(() => {
      const currentDrag = dragRef.current

      if (currentDrag && mapPaneRef.current) {
        mapPaneRef.current.style.transform = `translate3d(${currentDrag.deltaX}px, ${currentDrag.deltaY}px, 0)`
        currentDrag.animationFrame = undefined
      }
    })
  }

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current

    if (drag?.pointerId === event.pointerId) {
      if (drag.animationFrame) {
        window.cancelAnimationFrame(drag.animationFrame)
      }

      setView((current) => ({
        ...current,
        zoom: drag.startZoom,
        center: unprojectPoint(
          {
            x: drag.startCenterWorld.x - drag.deltaX,
            y: drag.startCenterWorld.y - drag.deltaY,
          },
          drag.startZoom,
        ),
      }))

      window.requestAnimationFrame(() => {
        if (mapPaneRef.current) {
          mapPaneRef.current.style.transform = ''
        }
      })

      dragRef.current = null
      setIsDragging(false)
    }
  }

  return (
    <section className="order-1 h-[58svh] shrink-0 bg-zinc-900 lg:order-2 lg:h-auto lg:min-h-0">
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        className={`relative h-full w-full touch-none overflow-hidden bg-sky-100 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div ref={mapPaneRef} className="absolute inset-0 will-change-transform">
          <div className="absolute inset-0">
            {tiles.map((tile) => (
              <img
                key={tile.key}
                alt=""
                draggable={false}
                decoding="async"
                src={`https://tile.openstreetmap.org/${view.zoom}/${tile.x}/${tile.y}.png`}
                className="absolute h-64 w-64 select-none"
                style={{
                  left: tile.left,
                  top: tile.top,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                }}
              />
            ))}
          </div>

          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
            <RouteLayer
              shapes={visibleShapes}
              routesById={network?.routesById}
              project={project}
              selectedRouteId={selectedRouteId}
            />
          </svg>

          {visibleStops.map(({ stop, point }) => (
            <StopMarker key={stop.id} stop={stop} point={point} detailed={view.zoom >= 16} />
          ))}

          {visibleVehiclePoints.map(({ vehicle, point }) => (
            <BusMarker
              key={vehicle.id}
              vehicle={vehicle}
              point={point}
              selected={vehicle.id === selectedVehicleId}
              onSelect={onSelectVehicle}
            />
          ))}

          {selectedVehicle ? <VehicleTooltip vehicle={selectedVehicle} point={project(selectedVehicle)} /> : null}
        </div>

        <MapControls
          onZoomIn={() => zoomAtCenter(view.zoom + 1)}
          onZoomOut={() => zoomAtCenter(view.zoom - 1)}
          onRecenter={recenter}
        />

        <div className="absolute bottom-4 left-4 z-40 max-w-[calc(100%-2rem)] rounded-md border border-white/70 bg-white/95 px-3 py-2 text-xs text-zinc-700 shadow-lg">
          <span className="font-medium">Zoom {view.zoom}</span>
          <span className="mx-2 text-zinc-400">·</span>
          <span>{visibleStops.length} arrêts</span>
          <span className="mx-2 text-zinc-400">·</span>
          <span>{visibleShapes.length} traces</span>
        </div>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-4 right-4 z-40 rounded-md bg-white/95 px-2 py-1 text-xs text-zinc-600 shadow"
        >
          © OpenStreetMap
        </a>

        {loading ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/35 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 shadow-2xl">
              <LoaderCircle className="h-5 w-5 animate-spin text-sky-300" aria-hidden="true" />
              Chargement des données SETRAM
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function VehicleTooltip({ vehicle, point }: { vehicle: Vehicle; point: Point }) {
  return (
    <div
      className="pointer-events-none absolute z-40 w-64 -translate-x-1/2 -translate-y-[calc(100%+2rem)] rounded-md border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-2xl"
      style={{ left: point.x, top: point.y }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl leading-none" aria-hidden="true">
          {getVehicleEmoji(vehicle)}
        </span>
        <RouteBadge route={vehicle.route} fallback={vehicle.routeId ?? 'Bus'} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Véhicule {vehicle.label}</div>
          <div className="truncate text-xs text-zinc-400">{vehicle.route?.longName ?? 'Ligne non renseignée'}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-zinc-900 p-2">
          <div className="text-zinc-500">Signal</div>
          <div>{formatAge(vehicle.timestamp)}</div>
        </div>
        <div className="rounded-md bg-zinc-900 p-2">
          <div className="text-zinc-500">Sens</div>
          <div>{formatDirection(vehicle, true)}</div>
        </div>
        <div className="rounded-md bg-zinc-900 p-2">
          <div className="text-zinc-500">Vitesse</div>
          <div>{formatSpeed(vehicle.speed)}</div>
        </div>
      </div>
    </div>
  )
}
