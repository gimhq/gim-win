const DEFAULT_MIME = 'application/octet-stream'

/** Extension -> mime type; the first extension of a type is its preferred one. */
const MIME_BY_EXTENSION: Record<string, string> = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  'heic': 'image/heic',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'ogg': 'audio/ogg',
  'wav': 'audio/wav',
  'pdf': 'application/pdf',
  'txt': 'text/plain',
  'md': 'text/markdown',
  'json': 'application/json',
  'zip': 'application/zip',
  '7z': 'application/x-7z-compressed',
  'rar': 'application/vnd.rar',
  'gz': 'application/gzip',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'csv': 'text/csv',
}

const EXTENSION_BY_MIME: Record<string, string> = {}
for (const [extension, mime] of Object.entries(MIME_BY_EXTENSION))
  EXTENSION_BY_MIME[mime] ??= extension

/** The last segment of a `/` or `\` separated path. */
export function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

/** The mime type for a file name or path by its extension; `application/octet-stream` when unknown. */
export function mimeFromFileName(name: string): string {
  const base = fileName(name)
  const dot = base.lastIndexOf('.')
  if (dot < 0)
    return DEFAULT_MIME
  return MIME_BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? DEFAULT_MIME
}

function essence(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase()
}

/** Raster image types shown inline; SVG is sent as a file. */
export function isImageMime(mime: string): boolean {
  const type = essence(mime)
  return type.startsWith('image/') && type !== 'image/svg+xml'
}

/** The preferred extension for a mime type (e.g. to name a pasted image); `bin` when unknown. */
export function extensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[essence(mime)] ?? 'bin'
}
