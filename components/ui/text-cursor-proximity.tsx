"use client"

import React, { CSSProperties, forwardRef, useMemo, useRef } from "react"
import { transform, useAnimationFrame } from "motion/react"
import { useMousePositionRef } from "@/hooks/use-mouse-position-ref"

// Helper type that makes all properties of CSSProperties accept number | string
type CSSPropertiesWithValues = {
  [K in keyof CSSProperties]: string | number
}

interface StyleValue<T extends keyof CSSPropertiesWithValues> {
  from: CSSPropertiesWithValues[T]
  to: CSSPropertiesWithValues[T]
}

interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string
  styles: Partial<{
    [K in keyof CSSPropertiesWithValues]: StyleValue<K>
  }>
  containerRef: React.RefObject<HTMLDivElement>
  radius?: number
  falloff?: "linear" | "exponential" | "gaussian"
}

const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number =>
  Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))

/**
 * Per-letter styling driven by cursor proximity.
 *
 * The interpolated styles are written straight to each letter's DOM node from the
 * animation frame. The obvious alternative — a MotionValue per letter and a
 * `useTransform` per style property — means calling hooks inside the render loop,
 * so the number of hooks becomes a function of the label length and the style
 * count. React only tolerates that while both happen to stay constant; change the
 * label at runtime and the component throws "rendered more hooks than during the
 * previous render". Writing to the node directly has no such coupling, and skips a
 * React render per frame besides.
 */
const TextCursorProximity = forwardRef<HTMLSpanElement, TextProps>(
  (
    {
      label,
      styles,
      containerRef,
      radius = 50,
      falloff = "linear",
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
    const mousePositionRef = useMousePositionRef(containerRef)

    // One interpolator per style property, mapping proximity 0..1 onto from..to.
    //
    // Endpoints that reference a CSS custom property (`hsl(var(--primary))`) cannot
    // go through motion's mixer: it has no way to resolve the variable, so it gives
    // up and returns the `to` value at every proximity — the colour looked animated
    // but was pinned to its end state. Those are handed to CSS as a `color-mix()`
    // instead, which resolves the variables at paint time and so keeps following
    // the light/dark theme for free.
    const interpolators = useMemo(
      () =>
        Object.entries(styles).map(([property, value]) => {
          const from = String(value.from)
          const to = String(value.to)

          if (from.includes("var(") || to.includes("var(")) {
            return [
              property,
              (progress: number) => {
                const pct = Math.min(Math.max(progress, 0), 1) * 100
                return `color-mix(in oklab, ${to} ${pct}%, ${from})`
              },
            ] as const
          }

          // `transform` is motion's standalone mapper — the same interpolation
          // `useTransform` performs, without being a hook.
          return [property, transform([0, 1], [value.from, value.to])] as const
        }),
      [styles]
    )

    const calculateFalloff = (distance: number): number => {
      const normalizedDistance = Math.min(Math.max(1 - distance / radius, 0), 1)

      switch (falloff) {
        case "exponential":
          return Math.pow(normalizedDistance, 2)
        case "gaussian":
          return Math.exp(-Math.pow(distance / (radius / 2), 2) / 2)
        case "linear":
        default:
          return normalizedDistance
      }
    }

    useAnimationFrame(() => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()

      letterRefs.current.forEach((letterRef) => {
        if (!letterRef) return

        const rect = letterRef.getBoundingClientRect()
        const letterCenterX = rect.left + rect.width / 2 - containerRect.left
        const letterCenterY = rect.top + rect.height / 2 - containerRect.top

        const distance = calculateDistance(
          mousePositionRef.current.x,
          mousePositionRef.current.y,
          letterCenterX,
          letterCenterY
        )

        const proximity = calculateFalloff(distance)

        for (const [property, interpolate] of interpolators) {
          letterRef.style[property as any] = String(interpolate(proximity))
        }
      })
    })

    const words = label.split(" ")
    let letterIndex = 0

    return (
      <span
        ref={ref}
        className={`${className} inline`}
        onClick={onClick}
        {...props}
      >
        {words.map((word, wordIndex) => (
          <span key={wordIndex} className="inline-block whitespace-nowrap">
            {word.split("").map((letter) => {
              const currentLetterIndex = letterIndex++

              return (
                <span
                  key={currentLetterIndex}
                  ref={(el: HTMLSpanElement | null) => {
                    letterRefs.current[currentLetterIndex] = el
                  }}
                  className="inline-block"
                  aria-hidden="true"
                >
                  {letter}
                </span>
              )
            })}
            {wordIndex < words.length - 1 && (
              <span className="inline-block">&nbsp;</span>
            )}
          </span>
        ))}
        <span className="sr-only">{label}</span>
      </span>
    )
  }
)

TextCursorProximity.displayName = "TextCursorProximity"
export default TextCursorProximity
