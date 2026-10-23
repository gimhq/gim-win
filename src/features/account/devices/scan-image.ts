import jsQR from 'jsqr'

/** Decodes the QR code in an image file; null when the image is unreadable or holds no QR code. */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  }
  catch {
    return null
  }
  const { width, height } = bitmap
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return null
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const imageData = context.getImageData(0, 0, width, height)
  return jsQR(imageData.data, width, height)?.data ?? null
}
