import { strFromU8, unzipSync } from 'fflate'
import Papa from 'papaparse'
import { STATIC_GTFS_URL } from '../constants/endpoints'
import type {
  Bounds,
  LatLng,
  Route,
  ServiceCalendar,
  Shape,
  StaticNetwork,
  Stop,
  StopDeparture,
  TripInfo,
} from '../types/transit'

type CsvRow = Record<string, string | undefined>

type ShapePoint = LatLng & {
  sequence: number
}

type TripStopPoint = {
  stationId: string
  sequence: number
}

const REQUIRED_FILES = new Set(['stops.txt', 'routes.txt', 'trips.txt', 'shapes.txt', 'stop_times.txt', 'calendar.txt'])
const OPTIONAL_FILES = new Set(['calendar_dates.txt'])
const MAX_POINTS_PER_SHAPE = 120

export async function loadStaticNetwork(): Promise<StaticNetwork> {
  const response = await fetch(STATIC_GTFS_URL)

  if (!response.ok) {
    throw new Error(`GTFS statique indisponible (${response.status})`)
  }

  const archive = new Uint8Array(await response.arrayBuffer())
  const files = unzipSync(archive, {
    filter: (file) => REQUIRED_FILES.has(file.name) || OPTIONAL_FILES.has(file.name),
  })

  for (const fileName of REQUIRED_FILES) {
    if (!files[fileName]) {
      throw new Error(`Fichier GTFS manquant: ${fileName}`)
    }
  }

  const stops = parseStops(strFromU8(files['stops.txt']))
  const routes = parseRoutes(strFromU8(files['routes.txt']))
  const { tripsById, tripRouteIds, tripShapeIds, shapeRouteIds } = parseTrips(strFromU8(files['trips.txt']))
  const shapes = parseShapes(strFromU8(files['shapes.txt']), shapeRouteIds)
  const stopsById = Object.fromEntries(stops.map((stop) => [stop.id, stop]))
  const routesById = Object.fromEntries(routes.map((route) => [route.id, route]))
  const servicesById = parseServices(
    strFromU8(files['calendar.txt']),
    files['calendar_dates.txt'] ? strFromU8(files['calendar_dates.txt']) : undefined,
  )
  const shapeIdsByRouteId = shapes.reduce<Record<string, string[]>>((acc, shape) => {
    if (!shape.routeId) {
      return acc
    }

    acc[shape.routeId] = acc[shape.routeId] ?? []
    acc[shape.routeId].push(shape.id)
    return acc
  }, {})

  for (const stop of stops) {
    if (stop.parentStation && stopsById[stop.parentStation]) {
      stop.parentStationName = stopsById[stop.parentStation].name
    }
  }

  const { stopDeparturesByStopId, tripStopIdsByTripId } = parseStopTimes(
    strFromU8(files['stop_times.txt']),
    tripsById,
    stopsById,
  )
  attachStopRouteMetadata(stops, stopDeparturesByStopId, routesById)

  return {
    stops,
    stationStops: stops.filter((stop) => stop.locationType === '1'),
    stopsById,
    routes,
    routesById,
    shapes,
    shapeIdsByRouteId,
    tripRouteIds,
    tripShapeIds,
    tripsById,
    tripStopIdsByTripId,
    servicesById,
    stopDeparturesByStopId,
    loadedAt: Date.now(),
  }
}

function parseCsv(csv: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length) {
    throw new Error(`CSV GTFS invalide: ${result.errors[0]?.message ?? 'erreur inconnue'}`)
  }

  return result.data
}

function parseStops(csv: string): Stop[] {
  return parseCsv(csv)
    .map((row) => ({
      id: row.stop_id?.trim() ?? '',
      code: row.stop_code?.trim() || undefined,
      name: row.stop_name?.trim() ?? 'Arrêt sans nom',
      lat: Number(row.stop_lat),
      lng: Number(row.stop_lon),
      locationType: row.location_type?.trim() || '0',
      parentStation: row.parent_station?.trim() || undefined,
      routeIds: [],
      transportTypes: [],
    }))
    .filter((stop) => stop.id && Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
}

function parseRoutes(csv: string): Route[] {
  return parseCsv(csv)
    .map((row) => ({
      id: row.route_id?.trim() ?? '',
      shortName: row.route_short_name?.trim() || row.route_id?.trim() || 'Ligne',
      longName: row.route_long_name?.trim() || 'Destination non renseignée',
      color: normalizeColor(row.route_color, '#dc2626'),
      textColor: normalizeColor(row.route_text_color, '#ffffff'),
      type: getRouteType(row.route_type),
      sortOrder: Number(row.route_sort_order ?? Number.MAX_SAFE_INTEGER),
    }))
    .filter((route) => route.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName, 'fr'))
}

function parseTrips(csv: string) {
  const tripsById: Record<string, TripInfo> = {}
  const tripRouteIds: Record<string, string> = {}
  const tripShapeIds: Record<string, string> = {}
  const shapeRouteIds = new Map<string, string>()

  for (const row of parseCsv(csv)) {
    const tripId = row.trip_id?.trim()
    const routeId = row.route_id?.trim()
    const serviceId = row.service_id?.trim()
    const shapeId = row.shape_id?.trim()
    const directionId = row.direction_id === undefined || row.direction_id === '' ? undefined : Number(row.direction_id)

    if (!tripId) {
      continue
    }

    tripsById[tripId] = {
      id: tripId,
      routeId,
      serviceId,
      shapeId,
      headsign: row.trip_headsign?.trim() || undefined,
      directionId: Number.isFinite(directionId) ? directionId : undefined,
    }

    if (routeId) {
      tripRouteIds[tripId] = routeId
    }

    if (shapeId) {
      tripShapeIds[tripId] = shapeId
    }

    if (routeId && shapeId && !shapeRouteIds.has(shapeId)) {
      shapeRouteIds.set(shapeId, routeId)
    }
  }

  return { tripsById, tripRouteIds, tripShapeIds, shapeRouteIds }
}

function parseServices(calendarCsv: string, calendarDatesCsv?: string): Record<string, ServiceCalendar> {
  const services: Record<string, ServiceCalendar> = {}

  for (const row of parseCsv(calendarCsv)) {
    const id = row.service_id?.trim()

    if (!id) {
      continue
    }

    services[id] = {
      id,
      weekdays: [
        row.sunday === '1',
        row.monday === '1',
        row.tuesday === '1',
        row.wednesday === '1',
        row.thursday === '1',
        row.friday === '1',
        row.saturday === '1',
      ],
      startDate: row.start_date?.trim() ?? '',
      endDate: row.end_date?.trim() ?? '',
      exceptions: {},
    }
  }

  if (calendarDatesCsv) {
    for (const row of parseCsv(calendarDatesCsv)) {
      const id = row.service_id?.trim()
      const date = row.date?.trim()
      const exceptionType = Number(row.exception_type)

      if (!id || !date || (exceptionType !== 1 && exceptionType !== 2)) {
        continue
      }

      services[id] = services[id] ?? {
        id,
        weekdays: [false, false, false, false, false, false, false],
        startDate: date,
        endDate: date,
        exceptions: {},
      }
      services[id].exceptions[date] = exceptionType
    }
  }

  return services
}

function parseStopTimes(
  csv: string,
  tripsById: Record<string, TripInfo>,
  stopsById: Record<string, Stop>,
): {
  stopDeparturesByStopId: Record<string, StopDeparture[]>
  tripStopIdsByTripId: Record<string, string[]>
} {
  const departuresByStopId: Record<string, StopDeparture[]> = {}
  const tripStops = new Map<string, TripStopPoint[]>()

  for (const row of parseCsv(csv)) {
    const tripId = row.trip_id?.trim()
    const stopId = row.stop_id?.trim()
    const trip = tripId ? tripsById[tripId] : undefined
    const stop = stopId ? stopsById[stopId] : undefined
    const routeId = trip?.routeId
    const departureSeconds = parseGtfsTime(row.departure_time ?? row.arrival_time)
    const arrivalSeconds = parseGtfsTime(row.arrival_time ?? row.departure_time)
    const sequence = Number(row.stop_sequence)

    if (!tripId || !stopId || !stop || !routeId || departureSeconds === undefined || arrivalSeconds === undefined) {
      continue
    }

    const departure: StopDeparture = {
      tripId,
      routeId,
      serviceId: trip.serviceId,
      stopId,
      stopName: stop.parentStationName ?? stop.name,
      arrivalSeconds,
      departureSeconds,
      headsign: row.stop_headsign?.trim() || trip.headsign,
      directionId: trip.directionId,
    }

    addStopDeparture(departuresByStopId, stopId, departure)

    if (stop.parentStation && stop.parentStation !== stopId) {
      addStopDeparture(departuresByStopId, stop.parentStation, departure)
    }

    if (Number.isFinite(sequence)) {
      const points = tripStops.get(tripId) ?? []
      points.push({
        stationId: stop.parentStation ?? stop.id,
        sequence,
      })
      tripStops.set(tripId, points)
    }
  }

  for (const departures of Object.values(departuresByStopId)) {
    departures.sort((a, b) => a.departureSeconds - b.departureSeconds || a.routeId.localeCompare(b.routeId, 'fr'))
  }

  const tripStopIdsByTripId = Object.fromEntries(
    Array.from(tripStops, ([tripId, points]) => {
      const stationIds = points
        .sort((a, b) => a.sequence - b.sequence)
        .map((point) => point.stationId)
        .filter((stationId, index, values) => stationId !== values[index - 1])

      return [tripId, stationIds]
    }),
  )

  return {
    stopDeparturesByStopId: departuresByStopId,
    tripStopIdsByTripId,
  }
}

function addStopDeparture(
  departuresByStopId: Record<string, StopDeparture[]>,
  stopId: string,
  departure: StopDeparture,
) {
  departuresByStopId[stopId] = departuresByStopId[stopId] ?? []
  departuresByStopId[stopId].push(departure)
}

function attachStopRouteMetadata(
  stops: Stop[],
  departuresByStopId: Record<string, StopDeparture[]>,
  routesById: Record<string, Route>,
) {
  for (const stop of stops) {
    const routeIds = Array.from(new Set((departuresByStopId[stop.id] ?? []).map((departure) => departure.routeId))).sort(
      (a, b) => {
        const routeA = routesById[a]
        const routeB = routesById[b]

        return (
          (routeA?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (routeB?.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
          (routeA?.shortName ?? a).localeCompare(routeB?.shortName ?? b, 'fr', { numeric: true })
        )
      },
    )

    stop.routeIds = routeIds
    stop.transportTypes = Array.from(
      new Set(routeIds.map((routeId) => routesById[routeId]?.type ?? 'Transport')),
    )
  }
}

function parseGtfsTime(value: string | undefined) {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/)

  if (!match) {
    return undefined
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])

  if (!Number.isFinite(hours) || minutes > 59 || seconds > 59) {
    return undefined
  }

  return hours * 3600 + minutes * 60 + seconds
}

function parseShapes(csv: string, shapeRouteIds: Map<string, string>): Shape[] {
  const grouped = new Map<string, ShapePoint[]>()

  for (const row of parseCsv(csv)) {
    const shapeId = row.shape_id?.trim()
    const lat = Number(row.shape_pt_lat)
    const lng = Number(row.shape_pt_lon)
    const sequence = Number(row.shape_pt_sequence)

    if (!shapeId || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(sequence)) {
      continue
    }

    grouped.set(shapeId, grouped.get(shapeId) ?? [])
    grouped.get(shapeId)?.push({ lat, lng, sequence })
  }

  return Array.from(grouped.entries())
    .map(([id, points]) => {
      const sampledPoints = sampleShape(points)

      return {
        id,
        routeId: shapeRouteIds.get(id) ?? '',
        points: sampledPoints,
        bounds: getBounds(sampledPoints),
      }
    })
    .filter((shape) => shape.routeId && shape.points.length > 1)
}

function sampleShape(points: ShapePoint[]): LatLng[] {
  const sorted = points.sort((a, b) => a.sequence - b.sequence)
  const stride = Math.max(1, Math.ceil(sorted.length / MAX_POINTS_PER_SHAPE))
  const sampled = sorted
    .filter((_, index) => index % stride === 0)
    .map(({ lat, lng }) => ({ lat, lng }))
  const last = sorted.at(-1)

  if (last) {
    const sampledLast = sampled.at(-1)

    if (!sampledLast || sampledLast.lat !== last.lat || sampledLast.lng !== last.lng) {
      sampled.push({ lat: last.lat, lng: last.lng })
    }
  }

  return sampled
}

function normalizeColor(value: string | undefined, fallback: string) {
  const color = value?.trim().replace('#', '')

  if (color && /^[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color}`
  }

  return fallback
}

function getBounds(points: LatLng[]): Bounds {
  return points.reduce<Bounds>(
    (bounds, point) => ({
      north: Math.max(bounds.north, point.lat),
      south: Math.min(bounds.south, point.lat),
      east: Math.max(bounds.east, point.lng),
      west: Math.min(bounds.west, point.lng),
    }),
    {
      north: -90,
      south: 90,
      east: -180,
      west: 180,
    },
  )
}

function getRouteType(routeType: string | undefined): Route['type'] {
  if (routeType === '0') {
    return 'Tram'
  }

  if (routeType === '3') {
    return 'Bus'
  }

  return 'Transport'
}
