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

    const CYCLE = 4500
    const els = {
      dome: svg.querySelector(`[data-orb="dome"]`) as SVGGElement,
      d: svg.querySelector(`[data-orb="d"]`) as SVGGElement,
      dot: svg.querySelector(`[data-orb="dot"]`) as SVGGElement,
      tri: svg.querySelector(`[data-orb="tri"]`) as SVGGElement,
    }

    const pivots: Record<string, [number, number]> = {
      dome: [24, 32], d: [66, 24], dot: [16, 66], tri: [66, 74],
    }

    const scatter: Record<string, { a: number[]; b: number[] }> = {
      dome: { a: [-38, -28, -18], b: [32, -34, 22] },
      d:    { a: [36, -32, 16],   b: [-34, 28, -18] },
      dot:  { a: [-30, 32, 12],   b: [26, 34, -20] },
      tri:  { a: [32, 30, -20],   b: [-36, -28, 16] },
    }

    const wobble: Record<string, { fx: number; fy: number; ax: number; ay: number }> = {
      dome: { fx: 1.7, fy: 2.3, ax: 3, ay: 2.5 },
      d:    { fx: 2.1, fy: 1.5, ax: 2.5, ay: 3 },
      dot:  { fx: 1.9, fy: 2.7, ax: 2, ay: 2 },
      tri:  { fx: 2.5, fy: 1.8, ax: 3, ay: 2.5 },
    }

    function smootherstep(t: number) {
      return t * t * t * (t * (t * 6 - 15) + 10)
    }
    function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

    let t0: number | null = null
    let rafId: number

    function tick(ts: number) {
      if (!t0) t0 = ts
      const t = ((ts - t0) % CYCLE) / CYCLE
      const timeSec = (ts - t0) / 1000

      for (const [name, el] of Object.entries(els)) {
        if (!el) continue
        const sa = scatter[name].a
        const sb = scatter[name].b
        const w = wobble[name]
        const [px, py] = pivots[name]

        let tx: number, ty: number, rot: number, sc: number, op: number

        if (t < 0.38) {
          const p = smootherstep(t / 0.38)
          const drift = p * 0.3
          tx = lerp(sa[0], 0, drift)
          ty = lerp(sa[1], 0, drift)
          rot = lerp(sa[2], 0, drift)
          sc = lerp(0.72, 0.85, p)
          op = lerp(0.55, 0.80, p)
          tx += Math.sin(timeSec * w.fx) * w.ax * (1 - drift)
          ty += Math.cos(timeSec * w.fy) * w.ay * (1 - drift)
        } else if (t < 0.45) {
          const p = smootherstep((t - 0.38) / 0.07)
          const startTx = sa[0] * 0.7
          const startTy = sa[1] * 0.7
          const startRot = sa[2] * 0.7
          tx = lerp(startTx, 0, p)
          ty = lerp(startTy, 0, p)
          rot = lerp(startRot, 0, p)
          sc = lerp(0.85, 1.0, p)
          op = lerp(0.80, 1.0, p)
        } else if (t < 0.58) {
          tx = 0; ty = 0; rot = 0
          const pulseT = (t - 0.45) / 0.13
          sc = 1.0 + 0.04 * Math.sin(pulseT * Math.PI)
          op = 1.0
        } else if (t < 0.65) {
          const p = smootherstep((t - 0.58) / 0.07)
          tx = lerp(0, sb[0] * 0.7, p)
          ty = lerp(0, sb[1] * 0.7, p)
          rot = lerp(0, sb[2] * 0.7, p)
          sc = lerp(1.0, 0.85, p)
          op = lerp(1.0, 0.80, p)
        } else {
          const p = smootherstep((t - 0.65) / 0.35)
          tx = lerp(sb[0], sa[0], p)
          ty = lerp(sb[1], sa[1], p)
          rot = lerp(sb[2], sa[2], p)
          sc = lerp(0.72, 0.72, p)
          op = lerp(0.65, 0.55, p)
          tx += Math.sin(timeSec * w.fx) * w.ax
          ty += Math.cos(timeSec * w.fy) * w.ay
        }

        el.setAttribute('transform',
          `translate(${tx} ${ty}) translate(${px} ${py}) rotate(${rot}) scale(${sc}) translate(${-px} ${-py})`
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
