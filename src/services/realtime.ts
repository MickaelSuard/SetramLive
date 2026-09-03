import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { VEHICLE_POSITIONS_URL } from '../constants/endpoints'
import type { RealtimeSnapshot, StaticNetwork, Vehicle } from '../types/transit'

type MaybeLong = number | string | { toString(): string } | null | undefined

type FeedMessageLike = {
  header: {
    gtfsRealtimeVersion?: string
    timestamp?: MaybeLong
  }
  entity: Array<{
    id?: string
    vehicle?: {
      trip?: {
        tripId?: string
        routeId?: string
        directionId?: number
      } | null
      vehicle?: {
        id?: string
        label?: string
      } | null
      position?: {
        latitude?: number
        longitude?: number
        bearing?: number
        speed?: number
      } | null
      timestamp?: MaybeLong
      stopId?: string
      currentStatus?: number | string
    } | null
  }>
}

type GtfsRoot = {
  transit_realtime: {
    FeedMessage: {
      decode(buffer: Uint8Array): FeedMessageLike
    }
  }
}

const gtfsRoot = (
  (GtfsRealtimeBindings as unknown as GtfsRoot).transit_realtime
    ? GtfsRealtimeBindings
    : (GtfsRealtimeBindings as unknown as { default: GtfsRoot }).default
) as unknown as GtfsRoot

export async function fetchVehiclePositions(network?: StaticNetwork): Promise<RealtimeSnapshot> {
  const response = await fetch(VEHICLE_POSITIONS_URL, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Flux temps réel indisponible (${response.status})`)
  }

  const feed = gtfsRoot.transit_realtime.FeedMessage.decode(new Uint8Array(await response.arrayBuffer()))
  const vehicles = feed.entity
    .map((entity) => mapVehicle(entity, network))
    .filter((vehicle): vehicle is Vehicle => Boolean(vehicle))
    .sort((a, b) => {
      const routeSort = (a.route?.sortOrder ?? 99999) - (b.route?.sortOrder ?? 99999)

      return routeSort || a.label.localeCompare(b.label, 'fr', { numeric: true })
    })

  return {
    vehicles,
    feedTimestamp: toNumber(feed.header.timestamp),
    fetchedAt: Date.now(),
    version: feed.header.gtfsRealtimeVersion,
  }
}

function mapVehicle(entity: FeedMessageLike['entity'][number], network?: StaticNetwork): Vehicle | null {
  const vehicle = entity.vehicle
  const position = vehicle?.position
  const lat = position?.latitude
  const lng = position?.longitude

  if (
    !vehicle ||
    !position ||
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null
  }

  const tripId = vehicle.trip?.tripId
  const routeId = vehicle.trip?.routeId ?? (tripId ? network?.tripRouteIds[tripId] : undefined)
  const stopId = vehicle.stopId
  const stop = stopId ? network?.stopsById[stopId] : undefined
  const route = routeId ? network?.routesById[routeId] : undefined

  return {
    id: vehicle.vehicle?.id ?? entity.id ?? `${lat}-${lng}`,
    label: vehicle.vehicle?.label ?? vehicle.vehicle?.id ?? entity.id ?? 'Véhicule',
    routeId,
    tripId,
    directionId: vehicle.trip?.directionId,
    stopId,
    stopName: stop?.parentStationName ?? stop?.name,
    lat,
    lng,
    bearing: normalizeNumber(position.bearing),
    speed: normalizeNumber(position.speed),
    timestamp: toNumber(vehicle.timestamp),
    status: getStatusLabel(vehicle.currentStatus),
    route,
  }
}

function toNumber(value: MaybeLong) {
  if (value === null || value === undefined) {
    return undefined
  }

  const parsed = Number(value.toString())

  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeNumber(value: number | undefined) {
  return Number.isFinite(value) ? value : undefined
}

function getStatusLabel(status: number | string | undefined) {
  const key = String(status ?? '')
  const labels: Record<string, string> = {
    '0': "Arrive à l'arrêt",
    '1': "À l'arrêt",
    '2': 'En route',
    INCOMING_AT: "Arrive à l'arrêt",
    STOPPED_AT: "À l'arrêt",
    IN_TRANSIT_TO: 'En route',
  }

  return labels[key] ?? 'Position reçue'
}
