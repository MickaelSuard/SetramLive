import { useEffect, useState } from 'react'
import { REALTIME_REFRESH_MS } from '../constants/endpoints'
import { fetchVehiclePositions } from '../services/realtime'
import type { LoadStatus, StaticNetwork, Vehicle } from '../types/transit'

type RealtimeState = {
  status: LoadStatus
  vehicles: Vehicle[]
  feedTimestamp?: number
  fetchedAt?: number
  version?: string
  error?: string
  isRefreshing: boolean
}

export function useRealtimeVehicles(network?: StaticNetwork) {
  const [state, setState] = useState<RealtimeState>({
    status: 'loading',
    vehicles: [],
    isRefreshing: false,
  })

  useEffect(() => {
    let alive = true
    let intervalId: number | undefined

    const load = async (initial = false) => {
      if (!alive) {
        return
      }

      setState((current) => ({
        ...current,
        status: initial && !current.vehicles.length ? 'loading' : current.status,
        isRefreshing: !initial,
      }))

      try {
        const snapshot = await fetchVehiclePositions(network)

        if (!alive) {
          return
        }

        setState({
          status: 'ready',
          vehicles: snapshot.vehicles,
          feedTimestamp: snapshot.feedTimestamp,
          fetchedAt: snapshot.fetchedAt,
          version: snapshot.version,
          isRefreshing: false,
        })
      } catch (error) {
        if (!alive) {
          return
        }

        setState((current) => ({
          ...current,
          status: current.vehicles.length ? 'ready' : 'error',
          error: error instanceof Error ? error.message : 'Lecture du temps réel impossible',
          isRefreshing: false,
        }))
      }
    }

    void load(true)
    intervalId = window.setInterval(() => {
      void load(false)
    }, REALTIME_REFRESH_MS)

    return () => {
      alive = false

      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [network])

  return state
}
