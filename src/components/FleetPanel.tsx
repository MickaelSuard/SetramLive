import { Layers, MapPinned, RefreshCw, RouteIcon, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LoadStatus, Route, StaticNetwork, Vehicle } from '../types/transit'
import { formatAge, formatClock } from '../utils/time'
import { formatDirection, getVehicleEmoji } from '../utils/vehicle'
import { LayerToggle } from './LayerToggle'
import { Metric } from './Metric'
import { RouteBadge } from './RouteBadge'
import { VehicleCard } from './VehicleCard'

type FleetPanelProps = {
  network?: StaticNetwork
  networkStatus: LoadStatus
  networkError?: string
  vehicles: Vehicle[]
  allVehicles: Vehicle[]
  selectedRouteId: string | null
  selectedVehicleId: string | null
  selectedVehicle?: Vehicle
  showStops: boolean
  showRoutes: boolean
  feedTimestamp?: number
  realtimeError?: string
  isRefreshing: boolean
  onSelectRoute: (routeId: string | null) => void
  onSelectVehicle: (vehicleId: string) => void
  onToggleStops: () => void
  onToggleRoutes: () => void
}

export function FleetPanel({
  network,
  networkStatus,
  networkError,
  vehicles,
  allVehicles,
  selectedRouteId,
  selectedVehicleId,
  selectedVehicle,
  showStops,
  showRoutes,
  feedTimestamp,
  realtimeError,
  isRefreshing,
  onSelectRoute,
  onSelectVehicle,
  onToggleStops,
  onToggleRoutes,
}: FleetPanelProps) {
  const [query, setQuery] = useState('')
  const routeCounts = useMemo(() => getRouteCounts(allVehicles), [allVehicles])
  const routes = useMemo(() => getRoutes(network, allVehicles), [network, allVehicles])
  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr')

    if (!normalizedQuery) {
      return vehicles
    }

    return vehicles.filter((vehicle) =>
      [
        vehicle.label,
        vehicle.route?.shortName,
        vehicle.route?.longName,
        vehicle.stopName,
        vehicle.status,
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase('fr').includes(normalizedQuery)),
    )
  }, [query, vehicles])

  return (
    <aside className="order-2 flex min-h-0 flex-1 flex-col border-t border-zinc-800 bg-zinc-950 text-zinc-100 lg:order-1 lg:border-r lg:border-t-0">
      <div className="space-y-4 border-b border-zinc-800 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Live" value={allVehicles.length} />
          <Metric label="Lignes" value={routeCounts.size} />
          <Metric label="Arrêts" value={network?.stationStops.length ?? '...'} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <LayerToggle icon={MapPinned} label="Arrêts" enabled={showStops} onToggle={onToggleStops} />
          <LayerToggle icon={RouteIcon} label="Tracés" enabled={showRoutes} onToggle={onToggleRoutes} />
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase text-zinc-500">Ligne</span>
          <select
            value={selectedRouteId ?? 'all'}
            onChange={(event) => onSelectRoute(event.target.value === 'all' ? null : event.target.value)}
            className="h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400"
          >
            <option value="all">Toutes les lignes</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.shortName} · {route.longName} ({routeCounts.get(route.id) ?? 0})
              </option>
            ))}
          </select>
        </label>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un véhicule, arrêt, ligne"
            className="h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 pl-10 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-400"
          />
        </label>
      </div>

      {selectedVehicle ? (
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none" aria-hidden="true">
              {getVehicleEmoji(selectedVehicle)}
            </span>
            <RouteBadge route={selectedVehicle.route} fallback={selectedVehicle.routeId ?? 'Bus'} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="truncate text-base font-semibold">Véhicule {selectedVehicle.label}</h2>
                <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
                  {formatClock(selectedVehicle.timestamp)}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-zinc-400">{selectedVehicle.route?.longName ?? 'Ligne non renseignée'}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md bg-zinc-900 p-2">
                  <div className="text-xs text-zinc-500">Position</div>
                  <div className="truncate text-zinc-200">{selectedVehicle.stopName ?? 'Arrêt inconnu'}</div>
                </div>
                <div className="rounded-md bg-zinc-900 p-2">
                  <div className="text-xs text-zinc-500">Sens</div>
                  <div className="truncate text-zinc-200">{formatDirection(selectedVehicle)}</div>
                </div>
                <div className="rounded-md bg-zinc-900 p-2">
                  <div className="text-xs text-zinc-500">Age signal</div>
                  <div className="truncate text-zinc-200">{formatAge(selectedVehicle.timestamp)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {(realtimeError || networkError) && (
        <div className="border-b border-rose-500/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {realtimeError ?? networkError}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 text-sm text-zinc-400">
        <span>{networkStatus === 'ready' ? 'GTFS statique chargé' : 'Chargement du réseau'}</span>
        <span className="inline-flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-sky-300' : ''}`} aria-hidden="true" />
          {formatAge(feedTimestamp)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-zinc-500">Véhicules visibles</h2>
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {filteredVehicles.length}
          </span>
        </div>

        <div className="space-y-2">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              selected={vehicle.id === selectedVehicleId}
              onSelect={onSelectVehicle}
            />
          ))}

          {!filteredVehicles.length && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
              Aucun véhicule dans ce filtre.
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function getRouteCounts(vehicles: Vehicle[]) {
  return vehicles.reduce<Map<string, number>>((acc, vehicle) => {
    if (vehicle.routeId) {
      acc.set(vehicle.routeId, (acc.get(vehicle.routeId) ?? 0) + 1)
    }

    return acc
  }, new Map())
}

function getRoutes(network: StaticNetwork | undefined, vehicles: Vehicle[]): Route[] {
  if (network) {
    return network.routes
  }

  const fallbackRoutes = vehicles
    .filter((vehicle) => vehicle.routeId)
    .map((vehicle) => ({
      id: vehicle.routeId ?? '',
      shortName: vehicle.routeId ?? 'Ligne',
      longName: 'Ligne temps réel',
      color: '#dc2626',
      textColor: '#ffffff',
      type: 'Bus' as const,
      sortOrder: 0,
    }))

  return Array.from(new Map(fallbackRoutes.map((route) => [route.id, route])).values())
}
