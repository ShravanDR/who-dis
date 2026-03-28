/**
 * Center-crop a File to 3:4 aspect ratio and return a Blob.
 * The crop is purely in-browser — the original file is never stored.
 */
export async function cropTo3x4(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)

      const targetRatio = 3 / 4  // width / height
      let srcX = 0, srcY = 0
      let srcW = img.naturalWidth
      let srcH = img.naturalHeight
      const naturalRatio = srcW / srcH

      if (naturalRatio > targetRatio) {
        // image is wider than 3:4 — crop sides
        srcW = Math.round(srcH * targetRatio)
        srcX = Math.round((img.naturalWidth - srcW) / 2)
      } else {
        // image is taller than 3:4 — crop top/bottom
        srcH = Math.round(srcW / targetRatio)
        srcY = Math.round((img.naturalHeight - srcH) / 2)
      }

      const canvas = document.createElement('canvas')
      const OUTPUT_W = 600
      const OUTPUT_H = 800
      canvas.width = OUTPUT_W
      canvas.height = OUTPUT_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_W, OUTPUT_H)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/jpeg',
        0.88
      )
    }
    img.onerror = reject
    img.src = url
  })
}
