import { useState, useEffect } from 'react'

const cache = new Map<string, string>()

export function useDominantColor(imageUrl: string | null | undefined, fallback = '#ffffff'): string {
  const [color, setColor] = useState<string>((imageUrl && cache.get(imageUrl)) || fallback)

  useEffect(() => {
    // No flag (placeholder/knockout slot) → keep the team's fallback colour and skip
    // the cross-origin canvas read entirely (avoids needless CORS console errors).
    if (!imageUrl) {
      setColor(fallback)
      return
    }
    if (cache.has(imageUrl)) {
      setColor(cache.get(imageUrl)!)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const SIZE = 40
        canvas.width = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, SIZE, SIZE)
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data

        const counts = new Map<string, number>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 128) continue
          // Quantize to 32-step buckets to merge near-identical shades
          const qr = Math.round(r / 32) * 32
          const qg = Math.round(g / 32) * 32
          const qb = Math.round(b / 32) * 32
          const key = `${qr},${qg},${qb}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }

        let best = ''
        let bestCount = 0
        for (const [key, count] of counts) {
          if (count > bestCount) {
            bestCount = count
            best = key
          }
        }

        if (best) {
          const [r, g, b] = best.split(',').map(Number)
          const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
          cache.set(imageUrl, hex)
          setColor(hex)
        }
      } catch {
        // CORS or canvas error — keep fallback
      }
    }
    img.src = imageUrl
  }, [imageUrl, fallback])

  return color
}
