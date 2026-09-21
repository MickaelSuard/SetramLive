import { BusFront, ChevronRight, Clock, MapPin, TramFront, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Route, StaticNetwork, Stop, Vehicle } from '../types/transit'
import { getStopTransportKind, getUpcomingDepartures } from '../utils/schedule'
import { RouteBadge } from './RouteBadge'

type StopInfoPanelProps = {
  stop: Stop
  network: StaticNetwork
  vehicles: Vehicle[]
  onClose: () => void
  onSelectVehicle: (vehicleId: string) => void
}

export function StopInfoPanel({ stop, network, vehicles, onClose, onSelectVehicle }: StopInfoPanelProps) {
  const [now, setNow] = useState(() => new Date())
  const transportKind = getStopTransportKind(stop)
  const routes = useMemo(
    () => stop.routeIds.map((routeId) => network.routesById[routeId]).filter((route): route is Route => Boolean(route)),
    [network.routesById, stop.routeIds],
  )
  const upcomingDepartures = useMemo(() => getUpcomingDepartures(network, stop, now), [network, now, stop])
  const vehiclesByTripId = useMemo(
    () => new Map(vehicles.filter((vehicle) => vehicle.tripId).map((vehicle) => [vehicle.tripId, vehicle])),
    [vehicles],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="absolute bottom-2 left-2 right-2 z-[1100] max-h-[min(72dvh,31rem)] overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:w-[26rem]"
    >
      <div className="flex items-start gap-3 border-b border-zinc-800 p-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${getStopKindClassName(
            transportKind,
          )}`}
          aria-hidden="true"
        >
          {transportKind === 'tram' ? <TramFront className="h-5 w-5" /> : <BusFront className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium uppercase text-zinc-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{getStopKindLabel(transportKind)}</span>
              </div>
              <h2 className="mt-0.5 line-clamp-2 text-base font-semibold leading-tight">{stop.name}</h2>
            </div>
            <button
              type="button"
              title="Fermer"
              aria-label="Fermer la fiche arrêt"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {routes.length ? (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {routes.slice(0, 10).map((route) => (
                <RouteBadge key={route.id} route={route} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-h-[calc(min(72dvh,31rem)-6rem)] overflow-y-auto overscroll-contain p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase text-zinc-500">Prochains passages</h3>
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            3 h
          </span>
        </div>

        <div className="space-y-2">
          {upcomingDepartures.map((departure) => {
            const liveVehicle = vehiclesByTripId.get(departure.tripId)

            return (
            <button
              key={`${departure.tripId}-${departure.stopId}-${departure.dueAt.getTime()}`}
              type="button"
              disabled={!liveVehicle}
              onClick={() => liveVehicle && onSelectVehicle(liveVehicle.id)}
              title={liveVehicle ? `Voir le véhicule ${liveVehicle.label} sur la carte` : 'Véhicule pas encore géolocalisé'}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-zinc-900 p-2.5 text-left transition enabled:hover:bg-zinc-800 enabled:active:bg-zinc-700"
            >
              <RouteBadge route={departure.route} fallback={departure.routeId} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {departure.headsign ? `vers ${departure.headsign}` : departure.route?.longName ?? 'Destination non renseignée'}
                </div>
                <div className="truncate text-xs text-zinc-500">{departure.route?.type ?? 'Transport'}</div>
              </div>
              <div className="flex items-center gap-1.5 text-right">
                <div>
                  <div className="text-sm font-semibold tabular-nums">{departure.timeLabel}</div>
                  <div className="text-xs text-sky-300">{departure.relativeLabel}</div>
                </div>
                {liveVehicle ? <ChevronRight className="h-4 w-4 text-zinc-500" aria-hidden="true" /> : null}
              </div>
            </button>
            )
          })}

          {!upcomingDepartures.length ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
              Aucun passage prévu dans les 3 prochaines heures.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function getStopKindLabel(kind: ReturnType<typeof getStopTransportKind>) {
  if (kind === 'tram') {
    return 'Arrêt tram'
  }

  if (kind === 'bus') {
    return 'Arrêt bus'
  }

  if (kind === 'mixed') {
    return 'Bus et tram'
  }

  return 'Arrêt'
}

function getStopKindClassName(kind: ReturnType<typeof getStopTransportKind>) {
  if (kind === 'tram') {
    return 'border-sky-400 bg-sky-500 text-white'
  }

  if (kind === 'mixed') {
    return 'border-emerald-300 bg-emerald-500 text-zinc-950'
  }

  return 'border-red-400 bg-red-600 text-white'
}
