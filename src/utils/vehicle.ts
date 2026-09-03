import type { Vehicle } from '../types/transit'

export function getVehicleEmoji(vehicle: Pick<Vehicle, 'route' | 'routeId'>) {
  return vehicle.route?.type === 'Tram' || vehicle.routeId?.startsWith('T') ? '🚋' : '🚌'
}

export function formatDirection(vehicle: Pick<Vehicle, 'directionId'>, compact = false) {
  if (typeof vehicle.directionId !== 'number') {
    return compact ? 'S?' : 'Sens inconnu'
  }

  const directionNumber = vehicle.directionId + 1

  return compact ? `S${directionNumber}` : `Sens ${directionNumber}`
}
