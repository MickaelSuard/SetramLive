import { useEffect, useState } from 'react'
import { loadStaticNetwork } from '../services/gtfs'
import type { LoadStatus, StaticNetwork } from '../types/transit'

type StaticNetworkState = {
  status: LoadStatus
  data?: StaticNetwork
  error?: string
}

export function useStaticNetwork() {
  const [state, setState] = useState<StaticNetworkState>({
    status: 'loading',
  })

  useEffect(() => {
    let alive = true
    const supportsWorker = typeof Worker !== 'undefined'

    if (supportsWorker) {
      const worker = new Worker(new URL('../workers/gtfsWorker.ts', import.meta.url), {
        type: 'module',
      })

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (!alive) {
          return
        }

        if (event.data.type === 'static-network-ready') {
          setState({ status: 'ready', data: event.data.data })
          return
        }

        setState({ status: 'error', error: event.data.error })
      }

      worker.onerror = () => {
        if (alive) {
          setState({ status: 'error', error: 'Chargement GTFS impossible' })
        }
      }

      worker.postMessage({ type: 'load-static-network' satisfies WorkerRequest['type'] })

      return () => {
        alive = false
        worker.terminate()
      }
    }

    loadStaticNetwork()
      .then((data) => {
        if (alive) {
          setState({ status: 'ready', data })
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : 'Chargement GTFS impossible',
          })
        }
      })

    return () => {
      alive = false
    }
  }, [])

  return state
}

type WorkerRequest = {
  type: 'load-static-network'
}

type WorkerResponse =
  | {
      type: 'static-network-ready'
      data: StaticNetwork
    }
  | {
      type: 'static-network-error'
      error: string
    }
