import { motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import './VariableProximity.css'

type Falloff = 'linear' | 'exponential' | 'gaussian'
type VariableProximityProps = {
  label: string
  containerRef: RefObject<HTMLElement | null>
  className?: string
  radius?: number
  falloff?: Falloff
  fromFontVariationSettings?: string
  toFontVariationSettings?: string
}

function parseSettings(settings: string) {
  return new Map(settings.split(',').map((item) => item.trim()).map((item) => {
    const [axis, value] = item.split(' ')
    return [axis.replace(/["']/g, ''), Number.parseFloat(value)]
  }))
}

export default function VariableProximity({
  label,
  containerRef,
  className = '',
  radius = 100,
  falloff = 'linear',
  fromFontVariationSettings = "'wght' 400, 'opsz' 14",
  toFontVariationSettings = "'wght' 900, 'opsz' 40",
}: VariableProximityProps) {
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([])
  const mousePosition = useRef({ x: 0, y: 0 })
  const lastPosition = useRef({ x: Number.NaN, y: Number.NaN })
  const settings = useMemo(() => {
    const from = parseSettings(fromFontVariationSettings)
    const to = parseSettings(toFontVariationSettings)
    return [...from].map(([axis, fromValue]) => ({ axis, fromValue, toValue: to.get(axis) ?? fromValue }))
  }, [fromFontVariationSettings, toFontVariationSettings])

  useEffect(() => {
    const updatePosition = (x: number, y: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) mousePosition.current = { x: x - rect.left, y: y - rect.top }
    }
    const onMouseMove = (event: MouseEvent) => updatePosition(event.clientX, event.clientY)
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (touch) updatePosition(touch.clientX, touch.clientY)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [containerRef])

  useEffect(() => {
    let frame = 0
    const animate = () => {
      const root = containerRef.current
      const pointer = mousePosition.current
      if (root && (lastPosition.current.x !== pointer.x || lastPosition.current.y !== pointer.y)) {
        lastPosition.current = { ...pointer }
        const rootRect = root.getBoundingClientRect()
        letterRefs.current.forEach((letter) => {
          if (!letter) return
          const rect = letter.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2 - rootRect.left
          const centerY = rect.top + rect.height / 2 - rootRect.top
          const distance = Math.hypot(pointer.x - centerX, pointer.y - centerY)
          const normalized = Math.min(Math.max(1 - distance / radius, 0), 1)
          const amount = falloff === 'exponential' ? normalized ** 2 : falloff === 'gaussian' ? Math.exp(-((distance / (radius / 2)) ** 2) / 2) : normalized
          letter.style.fontVariationSettings = settings.map(({ axis, fromValue, toValue }) => `'${axis}' ${fromValue + (toValue - fromValue) * amount}`).join(', ')
        })
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [containerRef, falloff, radius, settings])

  let letterIndex = 0
  const words = label.split(' ')
  return <span className={`variable-proximity ${className}`} aria-label={label}>
    {words.map((word, wordIndex) => <span className="variable-proximity-word" key={`${word}-${wordIndex}`}>
      {[...word].map((letter) => {
        const index = letterIndex++
        return <motion.span key={`${letter}-${index}`} ref={(node) => { letterRefs.current[index] = node }} aria-hidden="true">{letter}</motion.span>
      })}
      {wordIndex < words.length - 1 && <span aria-hidden="true">&nbsp;</span>}
    </span>)}
    <span className="sr-only">{label}</span>
  </span>
}