import { memo } from 'react'
import type { Stop } from '../types/transit'
import type { Point } from '../utils/geo'

type StopMarkerProps = {
  stop: Stop
  point: Point
  detailed: boolean
}

export const StopMarker = memo(function StopMarker({ stop, point, detailed }: StopMarkerProps) {
  return (
    <div
      className="group pointer-events-auto absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: point.x, top: point.y }}
    >
      <button
        type="button"
        title={stop.name}
        className={`block rounded-full border border-white bg-zinc-950 shadow-md transition group-hover:scale-125 ${
          detailed ? 'h-2.5 w-2.5' : 'h-2 w-2'
        }`}
      />
      <span className="pointer-events-none absolute left-1/2 top-3 hidden w-max max-w-44 -translate-x-1/2 rounded-md bg-zinc-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
        {stop.name}
      </span>
    </div>
  )
})
