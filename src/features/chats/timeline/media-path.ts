import { join } from '@tauri-apps/api/path'
import { prepareMediaDir } from '@/lib/api'
import { extensionForMime } from '../lib/mime'

/** `<appCacheDir>/media/<chatId>/<messageId>.<extension>`, inside the asset protocol scope; creates the directory first. */
export async function mediaCachePath(chatId: string, messageId: string, extension: string): Promise<string> {
  return join(await prepareMediaDir(chatId), `${messageId}.${extension}`)
}

/** The extension of a file name, else the preferred one of its mime type. */
export function extensionOf(fileName: string, mime: string): string {
  const dot = fileName.lastIndexOf('.')
  const extension = dot > 0
    ? fileName.slice(dot + 1).toLowerCase()
    : ''
  return /^[a-z0-9]{1,8}$/.test(extension)
    ? extension
    : extensionForMime(mime)
}

const MAX_SIDE = 320
const FALLBACK_SIDE = 240

/** `width` x `height` scaled down to fit `MAX_SIDE` x `MAX_SIDE`, keeping the aspect ratio. */
export function fitImage(width: number, height: number): { width: number, height: number } {
  if (width <= 0 || height <= 0)
    return { width: FALLBACK_SIDE, height: FALLBACK_SIDE }
  const scale = Math.min(1, MAX_SIDE / width, MAX_SIDE / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
