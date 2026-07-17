import { useRef } from 'react'
import VariableProximity from './VariableProximity'

export default function ProximityHeading({ label }: { label: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  return <span className="proximity-title" ref={ref}>
    <VariableProximity
      label={label}
      containerRef={ref}
      radius={100}
      falloff="linear"
      fromFontVariationSettings="'wght' 400, 'opsz' 14"
      toFontVariationSettings="'wght' 900, 'opsz' 40"
    />
  </span>
}