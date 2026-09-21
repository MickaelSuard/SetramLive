import type { LatLng, Route, StaticNetwork, Stop } from '../types/transit'
import { getUpcomingDepartures } from './schedule'
import type { UpcomingStopDeparture } from './schedule'

export type JourneyLocation = LatLng & {
  label: string
  accuracy?: number
}

export type JourneyLeg = {
  tripId: string
  route: Route
  from: Stop
  to: Stop
  departureAt: Date
  arrivalAt: Date
  headsign?: string
  shapeId?: string
}

export type JourneyPlan = {
  origin: JourneyLocation
  destination: JourneyLocation
  legs: JourneyLeg[]
  walkToBoardMeters: number
  walkFromAlightMeters: number
  departureAt: Date
  arrivalAt: Date
  totalMinutes: number
}

type NearbyStop = {
  stop: Stop
  distance: number
}

type JourneyCandidate = {
  plan: JourneyPlan
  score: number
}

const MAX_NEARBY_STOPS = 6
const MAX_WALK_DISTANCE_METERS = 2_000
const WALKING_METERS_PER_MINUTE = 75
const MIN_TRANSFER_MINUTES = 2

export function planJourney(
  network: StaticNetwork,
  origin: JourneyLocation,
  destination: JourneyLocation,
  now = new Date(),
): JourneyPlan | null {
  const originStops = findNearbyStops(network, origin)
  const destinationStops = findNearbyStops(network, destination)

  if (!originStops.length || !destinationStops.length) {
    return null
  }

  const directCandidates = findDirectJourneys(network, origin, destination, originStops, destinationStops, now)
  const transferCandidates = findTransferJourneys(
    network,
    origin,
    destination,
    originStops,
    destinationStops,
    now,
  )
  const candidates = [...directCandidates, ...transferCandidates].sort((a, b) => a.score - b.score)

  return candidates[0]?.plan ?? null
}

export function isLocationServed(network: StaticNetwork, point: LatLng) {
  const accuracyAllowance = getAccuracyAllowance(point)

  return network.stationStops.some(
    (stop) =>
      stop.routeIds.length > 0 &&
      distanceInMeters(point, stop) <= MAX_WALK_DISTANCE_METERS + accuracyAllowance,
  )
}

function findDirectJourneys(
  network: StaticNetwork,
  origin: JourneyLocation,
  destination: JourneyLocation,
  originStops: NearbyStop[],
  destinationStops: NearbyStop[],
  now: Date,
) {
  const candidates: JourneyCandidate[] = []

  for (const boarding of originStops) {
    const readyAt = addMinutes(now, walkingMinutes(boarding.distance))
    const departures = getUpcomingDepartures(network, boarding.stop, readyAt, 24, 180)

    for (const departure of departures) {
      for (const alighting of destinationStops) {
        if (!alighting.stop.routeIds.includes(departure.routeId)) {
          continue
        }

        const leg = buildLeg(network, departure, boarding.stop, alighting.stop)

        if (!leg) {
          continue
        }

        candidates.push(
          createCandidate(
            origin,
            destination,
            [leg],
            boarding.distance,
            alighting.distance,
            now,
          ),
        )
      }
    }
  }

  return candidates
}

function findTransferJourneys(
  network: StaticNetwork,
  origin: JourneyLocation,
  destination: JourneyLocation,
  originStops: NearbyStop[],
  destinationStops: NearbyStop[],
  now: Date,
) {
  const candidates: JourneyCandidate[] = []
  const destinationRouteIds = new Set(destinationStops.flatMap(({ stop }) => stop.routeIds))

  for (const boarding of originStops) {
    const readyAt = addMinutes(now, walkingMinutes(boarding.distance))
    const firstDepartures = getUpcomingDepartures(network, boarding.stop, readyAt, 14, 150)

    for (const firstDeparture of firstDepartures) {
      const sequence = network.tripStopIdsByTripId[firstDeparture.tripId] ?? []
      const boardingIndex = sequence.indexOf(boarding.stop.id)

      if (boardingIndex < 0) {
        continue
      }

      const transferStops = sequence
        .slice(boardingIndex + 1)
        .map((stopId) => network.stopsById[stopId])
        .filter((stop): stop is Stop => Boolean(stop))
        .filter((stop) =>
          stop.routeIds.some(
            (routeId) => routeId !== firstDeparture.routeId && destinationRouteIds.has(routeId),
          ),
        )
        .filter((stop, index, stops) => stops.findIndex((candidate) => candidate.id === stop.id) === index)
        .slice(0, 12)

      for (const transferStop of transferStops) {
        const firstLeg = buildLeg(network, firstDeparture, boarding.stop, transferStop)

        if (!firstLeg) {
          continue
        }

        const transferReadyAt = addMinutes(firstLeg.arrivalAt, MIN_TRANSFER_MINUTES)
        const secondDepartures = getUpcomingDepartures(network, transferStop, transferReadyAt, 18, 120)
          .filter(
            (departure) =>
              departure.routeId !== firstDeparture.routeId && destinationRouteIds.has(departure.routeId),
          )

        for (const secondDeparture of secondDepartures) {
          for (const alighting of destinationStops) {
            if (!alighting.stop.routeIds.includes(secondDeparture.routeId)) {
              continue
            }

            const secondLeg = buildLeg(network, secondDeparture, transferStop, alighting.stop)

            if (!secondLeg) {
              continue
            }

            candidates.push(
              createCandidate(
                origin,
                destination,
                [firstLeg, secondLeg],
                boarding.distance,
                alighting.distance,
                now,
              ),
            )
          }
        }
      }
    }
  }

  return candidates
}

function buildLeg(
  network: StaticNetwork,
  departure: UpcomingStopDeparture,
  from: Stop,
  to: Stop,
): JourneyLeg | null {
  const route = network.routesById[departure.routeId]
  const sequence = network.tripStopIdsByTripId[departure.tripId] ?? []
  const fromIndex = sequence.indexOf(from.id)
  const toIndex = fromIndex >= 0 ? sequence.indexOf(to.id, fromIndex + 1) : -1

  if (!route || fromIndex < 0 || toIndex <= fromIndex) {
    return null
  }

  const fromSchedule = (network.stopDeparturesByStopId[from.id] ?? [])
    .find((item) => item.tripId === departure.tripId)
  const toSchedule = (network.stopDeparturesByStopId[to.id] ?? [])
    .find((item) => item.tripId === departure.tripId)

  if (!fromSchedule || !toSchedule) {
    return null
  }

  let durationSeconds = toSchedule.arrivalSeconds - fromSchedule.departureSeconds

  if (durationSeconds < 0) {
    durationSeconds += 24 * 60 * 60
  }

  if (durationSeconds <= 0 || durationSeconds > 4 * 60 * 60) {
    return null
  }

  return {
    tripId: departure.tripId,
    route,
    from,
    to,
    departureAt: departure.dueAt,
    arrivalAt: new Date(departure.dueAt.getTime() + durationSeconds * 1000),
    headsign: departure.headsign,
    shapeId: network.tripShapeIds[departure.tripId],
  }
}

function createCandidate(
  origin: JourneyLocation,
  destination: JourneyLocation,
  legs: JourneyLeg[],
  walkToBoardMeters: number,
  walkFromAlightMeters: number,
  now: Date,
): JourneyCandidate {
  const departureAt = legs[0].departureAt
  const transitArrivalAt = legs.at(-1)?.arrivalAt ?? departureAt
  const arrivalAt = addMinutes(transitArrivalAt, walkingMinutes(walkFromAlightMeters))
  const totalMinutes = Math.max(1, Math.ceil((arrivalAt.getTime() - now.getTime()) / 60_000))

  return {
    plan: {
      origin,
      destination,
      legs,
      walkToBoardMeters,
      walkFromAlightMeters,
      departureAt,
      arrivalAt,
      totalMinutes,
    },
    score: arrivalAt.getTime() + Math.max(0, legs.length - 1) * 5 * 60_000,
  }
}

function findNearbyStops(network: StaticNetwork, point: LatLng): NearbyStop[] {
  const accuracyAllowance = getAccuracyAllowance(point)

  return network.stationStops
    .filter((stop) => stop.routeIds.length > 0)
    .map((stop) => {
      const measuredDistance = distanceInMeters(point, stop)

      return {
        stop,
        measuredDistance,
        distance: Math.max(0, measuredDistance - accuracyAllowance),
      }
    })
    .filter(({ measuredDistance }) => measuredDistance <= MAX_WALK_DISTANCE_METERS + accuracyAllowance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_NEARBY_STOPS)
}

function getAccuracyAllowance(point: LatLng) {
  const accuracy = 'accuracy' in point && typeof point.accuracy === 'number' ? point.accuracy : 0

  return Math.min(Math.max(0, accuracy), 2_000)
}

function walkingMinutes(distance: number) {
  return Math.max(1, Math.ceil(distance / WALKING_METERS_PER_MINUTE))
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

function distanceInMeters(first: LatLng, second: LatLng) {
  const earthRadius = 6_371_000
  const firstLat = toRadians(first.lat)
  const secondLat = toRadians(second.lat)
  const deltaLat = secondLat - firstLat
  const deltaLng = toRadians(second.lng - first.lng)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine))
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}
