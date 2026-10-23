import jsQR from 'jsqr'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

/**
 * The text of the first QR code in an image (a picked file or a pasted
 * clipboard image), or null when the image has no code or cannot be read.
 */
export async function decodeQrFromImage(source: Blob): Promise<string | null> {
  const url = URL.createObjectURL(source)
  try {
    const image = await loadImage(url)
    if (!image)
      return null
    const width = image.naturalWidth
    const height = image.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context || width === 0 || height === 0)
      return null
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, width, height)
    return jsQR(data, width, height)?.data ?? null
  }
  finally {
    URL.revokeObjectURL(url)
  }
}
