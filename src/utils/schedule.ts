import type { Route, ServiceCalendar, StaticNetwork, Stop, StopDeparture } from '../types/transit'

export type UpcomingStopDeparture = StopDeparture & {
  route?: Route
  dueAt: Date
  minutesUntil: number
  relativeLabel: string
  timeLabel: string
}

const SERVICE_DAY_OFFSETS = [-1, 0, 1]

export function getUpcomingDepartures(
  network: StaticNetwork,
  stop: Stop,
  now = new Date(),
  limit = 8,
  horizonMinutes = 180,
): UpcomingStopDeparture[] {
  const departures = network.stopDeparturesByStopId[stop.id] ?? []
  const nowMs = now.getTime()
  const horizonMs = nowMs + horizonMinutes * 60_000
  const todayStart = startOfLocalDay(now)
  const seen = new Set<string>()
  const upcoming: UpcomingStopDeparture[] = []

  for (const offset of SERVICE_DAY_OFFSETS) {
    const serviceDayStart = new Date(todayStart)
    serviceDayStart.setDate(todayStart.getDate() + offset)
    const serviceDate = formatGtfsDate(serviceDayStart)

    for (const departure of departures) {
      if (
        departure.serviceId &&
        !isServiceActive(network.servicesById[departure.serviceId], serviceDate, serviceDayStart.getDay())
      ) {
        continue
      }

      const dueAtMs = serviceDayStart.getTime() + departure.departureSeconds * 1000

      if (dueAtMs < nowMs - 30_000 || dueAtMs > horizonMs) {
        continue
      }

      const key = `${departure.tripId}-${departure.stopId}-${dueAtMs}`

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      upcoming.push({
        ...departure,
        route: network.routesById[departure.routeId],
        dueAt: new Date(dueAtMs),
        minutesUntil: Math.max(0, Math.ceil((dueAtMs - nowMs) / 60_000)),
        relativeLabel: formatRelativeTime(dueAtMs, nowMs),
        timeLabel: formatDepartureTime(dueAtMs),
      })
    }
  }

  return upcoming
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || routeSortValue(a.route) - routeSortValue(b.route))
    .slice(0, limit)
}

export function getStopTransportKind(stop: Stop): 'tram' | 'bus' | 'mixed' | 'unknown' {
  const hasTram = stop.transportTypes.includes('Tram')
  const hasBus = stop.transportTypes.includes('Bus')

  if (hasTram && hasBus) {
    return 'mixed'
  }

  if (hasTram) {
    return 'tram'
  }

  if (hasBus) {
    return 'bus'
  }

  return 'unknown'
}

function isServiceActive(service: ServiceCalendar | undefined, date: string, weekday: number) {
  if (!service) {
    return true
  }

  const exception = service.exceptions[date]

  if (exception === 1) {
    return true
  }

  if (exception === 2) {
    return false
  }

  return date >= service.startDate && date <= service.endDate && Boolean(service.weekdays[weekday])
}

function startOfLocalDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatGtfsDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}${month}${day}`
}

function formatDepartureTime(timestamp: number) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatRelativeTime(dueAtMs: number, nowMs: number) {
  const minutes = Math.max(0, Math.ceil((dueAtMs - nowMs) / 60_000))

  if (minutes <= 0) {
    return 'Maintenant'
  }

  if (minutes === 1) {
    return 'Dans 1 min'
  }

  return `Dans ${minutes} min`
}

function routeSortValue(route: Route | undefined) {
  return route?.sortOrder ?? Number.MAX_SAFE_INTEGER
}
