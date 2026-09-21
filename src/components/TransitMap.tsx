import { canvas, latLngBounds } from 'leaflet'
import type { LatLngBounds, Map as LeafletMap } from 'leaflet'
import { LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { DEFAULT_CENTER } from '../constants/endpoints'
import type { LatLng, StaticNetwork, Vehicle } from '../types/transit'
import { BusMarker } from './BusMarker'
import { MapControls } from './MapControls'
import { RouteLayer } from './RouteLayer'
import { StopInfoPanel } from './StopInfoPanel'
import { StopMarker } from './StopMarker'
import { VehicleInfoPanel } from './VehicleInfoPanel'

type TransitMapProps = {
  network?: StaticNetwork
  vehicles: Vehicle[]
  allVehicles: Vehicle[]
  selectedVehicleId: string | null
  selectedRouteId: string | null
  showStops: boolean
  showRoutes: boolean
  loading: boolean
  onSelectVehicle: (vehicleId: string) => void
  onClearVehicle: () => void
}

type Viewport = {
  bounds: LatLngBounds
  zoom: number
}

const STOP_DETAIL_ZOOM = 16
const STOP_OVERVIEW_ZOOM = 15
const OVERVIEW_RADIUS_RATIO = 0.42
const MAX_OVERVIEW_STOPS = 28
const MAX_VISIBLE_STOPS = 450

export function TransitMap({
  network,
  vehicles,
  allVehicles,
  selectedVehicleId,
  selectedRouteId,
  showStops,
  showRoutes,
  loading,
  onSelectVehicle,
  onClearVehicle,
}: TransitMapProps) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const renderer = useMemo(() => canvas({ padding: 0.5, tolerance: 8 }), [])
  const selectedVehicle = useMemo(
    () => allVehicles.find((vehicle) => vehicle.id === selectedVehicleId),
    [allVehicles, selectedVehicleId],
  )
  const selectedStop = useMemo(
    () => (selectedStopId && network ? network.stopsById[selectedStopId] : undefined),
    [network, selectedStopId],
  )
  const displayedVehicles = useMemo(() => {
    if (!selectedVehicle || vehicles.some((vehicle) => vehicle.id === selectedVehicle.id)) {
      return vehicles
    }

    return [...vehicles, selectedVehicle]
  }, [selectedVehicle, vehicles])
  const displayedShapes = useMemo(() => {
    if (!network || !showRoutes) {
      return []
    }

    return selectedRouteId
      ? network.shapes.filter((shape) => shape.routeId === selectedRouteId)
      : network.shapes
  }, [network, selectedRouteId, showRoutes])
  const handleSelectStop = useCallback(
    (stopId: string) => {
      setSelectedStopId(stopId)
      onClearVehicle()
    },
    [onClearVehicle],
  )
  const handleSelectVehicle = useCallback(
    (vehicleId: string) => {
      setSelectedStopId(null)
      onSelectVehicle(vehicleId)
    },
    [onSelectVehicle],
  )

  useEffect(() => {
    if (selectedVehicleId) {
      // oxlint-disable-next-line react/set-state-in-effect
      setSelectedStopId(null)
    }
  }, [selectedVehicleId])

  useEffect(() => {
    if (!showStops) {
      // oxlint-disable-next-line react/set-state-in-effect
      setSelectedStopId(null)
    }
  }, [showStops])

  return (
    <section className="order-1 min-h-0 flex-1 bg-zinc-900 lg:order-2 lg:h-auto lg:min-h-0">
      <div className="relative h-full w-full overflow-hidden bg-sky-100">
        <MapContainer
          center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
          zoom={13}
          minZoom={11}
          maxZoom={18}
          zoomControl={false}
          renderer={renderer}
          preferCanvas
          zoomAnimation
          fadeAnimation
          markerZoomAnimation
          wheelDebounceTime={60}
          wheelPxPerZoomLevel={90}
          zoomDelta={0.5}
          zoomSnap={0.5}
          touchZoom="center"
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            keepBuffer={3}
            updateWhenIdle
            updateWhenZooming={false}
          />

          <MapResizeController />
          <MapViewportController
            network={network}
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            selectedVehicleId={selectedVehicleId}
            selectedRouteId={selectedRouteId}
          />

          <RouteLayer
            shapes={displayedShapes}
            routesById={network?.routesById}
            renderer={renderer}
            selectedRouteId={selectedRouteId}
          />

          {network && showStops ? (
            <StopsLayer
              network={network}
              selectedStopId={selectedStopId}
              onSelect={handleSelectStop}
            />
          ) : null}

          {displayedVehicles.map((vehicle) => (
            <BusMarker
              key={vehicle.id}
              vehicle={vehicle}
              selected={vehicle.id === selectedVehicleId}
              onSelect={handleSelectVehicle}
            />
          ))}

          <LeafletMapControls points={vehicles.length ? vehicles : network?.stationStops ?? []} />
        </MapContainer>

        <div className="pointer-events-none absolute left-2 top-2 z-[1000] flex w-max max-w-[calc(100%-4rem)] items-center gap-2 rounded-md border border-white/70 bg-white/95 px-2 py-1.5 text-[10px] text-zinc-700 shadow-lg sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
          <LegendMarker variant="bus" label="Bus" />
          <LegendMarker variant="tram" label="Tram" />
          <LegendMarker variant="mixed" label="Mixte" />
        </div>

        {selectedVehicle ? <VehicleInfoPanel vehicle={selectedVehicle} onClose={onClearVehicle} /> : null}
        {selectedStop && network && !selectedVehicle ? (
          <StopInfoPanel
            stop={selectedStop}
            network={network}
            vehicles={allVehicles}
            onClose={() => setSelectedStopId(null)}
            onSelectVehicle={handleSelectVehicle}
          />
        ) : null}

        {loading ? (
          <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-zinc-950/35 backdrop-blur-sm">
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

function StopsLayer({
  network,
  selectedStopId,
  onSelect,
}: {
  network: StaticNetwork
  selectedStopId: string | null
  onSelect: (stopId: string) => void
}) {
  const map = useMap()
  const [viewport, setViewport] = useState<Viewport>(() => ({
    bounds: map.getBounds(),
    zoom: map.getZoom(),
  }))
  const updateViewport = useCallback(() => {
    setViewport({
      bounds: map.getBounds(),
      zoom: map.getZoom(),
    })
  }, [map])

  useMapEvents({
    moveend: updateViewport,
    zoomend: updateViewport,
  })

  const visibleStops = useMemo(() => {
    const detailed = viewport.zoom >= STOP_DETAIL_ZOOM
    const source = detailed
      ? network.stops.filter((stop) => stop.locationType !== '1')
      : network.stationStops.filter((stop) =>
          stop.transportTypes.some((type) => type === 'Bus' || type === 'Tram'),
        )

    if (viewport.zoom < STOP_OVERVIEW_ZOOM) {
      const size = map.getSize()
      const center = size.divideBy(2)
      const radius = Math.min(size.x, size.y) * OVERVIEW_RADIUS_RATIO

      return source
        .map((stop) => ({
          stop,
          distance: map.latLngToContainerPoint([stop.lat, stop.lng]).distanceTo(center),
        }))
        .filter(({ distance }) => distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_OVERVIEW_STOPS)
        .map(({ stop }) => stop)
    }

    const paddedBounds = viewport.bounds.pad(0.18)
    return source
      .filter((stop) => paddedBounds.contains([stop.lat, stop.lng]))
      .slice(0, MAX_VISIBLE_STOPS)
  }, [map, network, viewport])

  return visibleStops.map((stop) => (
    <StopMarker
      key={stop.id}
      stop={stop}
      detailed={viewport.zoom >= STOP_DETAIL_ZOOM}
      selected={stop.id === selectedStopId}
      onSelect={onSelect}
    />
  ))
}

function MapViewportController({
  network,
  vehicles,
  selectedVehicle,
  selectedVehicleId,
  selectedRouteId,
}: {
  network?: StaticNetwork
  vehicles: Vehicle[]
  selectedVehicle?: Vehicle
  selectedVehicleId: string | null
  selectedRouteId: string | null
}) {
  const map = useMap()
  const initialFitDone = useRef(false)
  const previousVehicleId = useRef<string | null>(null)
  const previousRouteId = useRef<string | null>(null)

  useEffect(() => {
    if (initialFitDone.current || !vehicles.length) {
      return
    }

    fitMapToPoints(map, vehicles, 14, false)
    initialFitDone.current = true
  }, [map, vehicles])

  useEffect(() => {
    if (selectedVehicleId === previousVehicleId.current) {
      return
    }

    previousVehicleId.current = selectedVehicleId

    if (selectedVehicle) {
      map.flyTo(
        [selectedVehicle.lat, selectedVehicle.lng],
        Math.max(15, map.getZoom()),
        { animate: true, duration: 0.45 },
      )
    }
  }, [map, selectedVehicle, selectedVehicleId])

  useEffect(() => {
    if (selectedRouteId === previousRouteId.current) {
      return
    }

    previousRouteId.current = selectedRouteId

    if (!selectedRouteId || selectedVehicleId) {
      return
    }

    const routePoints = network?.shapes
      .filter((shape) => shape.routeId === selectedRouteId)
      .flatMap((shape) => shape.points)
    fitMapToPoints(map, vehicles.length ? vehicles : routePoints ?? [], 15)
  }, [map, network, selectedRouteId, selectedVehicleId, vehicles])

  return null
}

function MapResizeController() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    let animationFrame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    })

    observer.observe(container)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer.disconnect()
    }
  }, [map])

  return null
}

function LeafletMapControls({ points }: { points: LatLng[] }) {
  const map = useMap()

  return (
    <MapControls
      onZoomIn={() => map.zoomIn(0.5)}
      onZoomOut={() => map.zoomOut(0.5)}
      onRecenter={() => fitMapToPoints(map, points, 14)}
    />
  )
}

function fitMapToPoints(map: LeafletMap, points: LatLng[], maxZoom: number, animate = true) {
  if (!points.length) {
    return
  }

  const bounds = latLngBounds(points.map((point) => [point.lat, point.lng]))
  map.fitBounds(bounds, {
    animate,
    duration: animate ? 0.4 : 0,
    maxZoom,
    padding: [44, 44],
  })
}

function LegendMarker({ variant, label }: { variant: 'bus' | 'tram' | 'mixed'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`block h-2.5 w-2.5 border border-white shadow-sm ${
          variant === 'tram' ? 'rotate-45 rounded-[2px] bg-sky-500' : 'rounded-full bg-red-600'
        } ${variant === 'mixed' ? 'rounded-[3px]' : ''}`}
        style={
          variant === 'mixed'
            ? { background: 'linear-gradient(135deg, #0284c7 0 50%, #dc2626 50% 100%)' }
            : undefined
        }
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  )
}
