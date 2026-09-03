import { loadStaticNetwork } from '../services/gtfs'

type WorkerRequest = {
  type: 'load-static-network'
}

type WorkerResponse =
  | {
      type: 'static-network-ready'
      data: Awaited<ReturnType<typeof loadStaticNetwork>>
    }
  | {
      type: 'static-network-error'
      error: string
    }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

workerScope.onmessage = (event) => {
  if (event.data.type !== 'load-static-network') {
    return
  }

  loadStaticNetwork()
    .then((data) => {
      workerScope.postMessage({
        type: 'static-network-ready',
        data,
      })
    })
    .catch((error: unknown) => {
      workerScope.postMessage({
        type: 'static-network-error',
        error: error instanceof Error ? error.message : 'Chargement GTFS impossible',
      })
    })
}
