import { memo } from 'react'
import type { Route } from '../types/transit'

type RouteBadgeProps = {
  route?: Route
  fallback?: string
}

export const RouteBadge = memo(function RouteBadge({ route, fallback = '?' }: RouteBadgeProps) {
  return (
    <span
      className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-2 text-xs font-bold"
      style={{
        backgroundColor: route?.color ?? '#52525b',
        color: route?.textColor ?? '#ffffff',
      }}
    >
      {route?.shortName ?? fallback}
    </span>
  )
})
