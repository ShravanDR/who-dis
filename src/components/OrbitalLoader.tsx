import { useEffect, useRef, useId } from 'react'

interface Props {
  size?: number
  className?: string
}

export default function OrbitalLoader({ size = 80, className = '' }: Props) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const CYCLE = 5000 // ms per full orbit cycle
    const els = {
      dome: svg.querySelector(`[data-orb="dome"]`) as SVGGElement,
      d: svg.querySelector(`[data-orb="d"]`) as SVGGElement,
      dot: svg.querySelector(`[data-orb="dot"]`) as SVGGElement,
      tri: svg.querySelector(`[data-orb="tri"]`) as SVGGElement,
    }

    // Logo-assembled positions (center of each shape)
    const home: Record<string, [number, number]> = {
      dome: [24, 32], d: [66, 24], dot: [16, 66], tri: [66, 74],
    }

    // Orbit parameters: each piece orbits at different radius, speed, phase
    const orbits: Record<string, { rx: number; ry: number; speed: number; phase: number; rotSpeed: number }> = {
      dome: { rx: 34, ry: 28, speed: 1.0, phase: 0, rotSpeed: 0.8 },
      d:    { rx: 30, ry: 36, speed: 1.0, phase: Math.PI * 0.5, rotSpeed: -0.6 },
      dot:  { rx: 32, ry: 30, speed: 1.0, phase: Math.PI, rotSpeed: 0.7 },
      tri:  { rx: 28, ry: 34, speed: 1.0, phase: Math.PI * 1.5, rotSpeed: -0.9 },
    }

    let t0: number | null = null
    let rafId: number

    function tick(ts: number) {
      if (!t0) t0 = ts
      const elapsed = (ts - t0) / 1000
      const cycleT = ((ts - t0) % CYCLE) / CYCLE

      // Smooth convergence: 0 = scattered/orbiting, 1 = assembled
      // Uses a smooth bell curve that peaks at cycleT ≈ 0.5
      const convergence = Math.pow(Math.sin(cycleT * Math.PI), 2.5)

      for (const [name, el] of Object.entries(els)) {
        if (!el) continue
        const [hx, hy] = home[name]
        const orb = orbits[name]

        // Orbital position (scattered state)
        const angle = elapsed * orb.speed + orb.phase
        const ox = Math.sin(angle) * orb.rx
        const oy = Math.cos(angle) * orb.ry

        // Blend between orbit and home
        const tx = ox * (1 - convergence)
        const ty = oy * (1 - convergence)

        // Rotation: spins when scattered, settles when assembled
        const rot = elapsed * orb.rotSpeed * 40 * (1 - convergence)

        // Scale: smaller when scattered, full when assembled
        const sc = 0.7 + 0.3 * convergence

        // Opacity: dimmer when scattered, full when assembled
        const op = 0.5 + 0.5 * convergence

        el.setAttribute('transform',
          `translate(${tx} ${ty}) translate(${hx} ${hy}) rotate(${rot}) scale(${sc}) translate(${-hx} ${-hy})`
        )
        el.style.opacity = String(op)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
      className={className}
    >
      <defs>
        <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.2 0" result="bright" />
          <feMerge>
            <feMergeNode in="bright" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g data-orb="dome" filter={`url(#glow-${uid})`}>
        <path fill="#E8572A" d="M 0 48 A 24 24 0 0 1 48 48 Z" />
      </g>
      <g data-orb="d" filter={`url(#glow-${uid})`}>
        <path fill="#E8572A" d="M 52 0 A 24 24 0 0 1 52 48 Z" />
      </g>
      <g data-orb="dot" filter={`url(#glow-${uid})`}>
        <circle fill="#E8572A" cx="16" cy="66" r="9" />
      </g>
      <g data-orb="tri" filter={`url(#glow-${uid})`}>
        <polygon fill="#E8572A" points="52,54 95,74 52,94" />
      </g>
    </svg>
  )
}
