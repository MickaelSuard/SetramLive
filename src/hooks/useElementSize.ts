import { useLayoutEffect, useRef, useState } from 'react'
import type { MapSize } from '../utils/geo'

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<MapSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (!ref.current) {
      return undefined
    }

    const element = ref.current
    const updateSize = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    }
    const observer = new ResizeObserver(updateSize)

    updateSize()
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}
