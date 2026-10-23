import { extensionForMime, fileName, isImageMime, mimeFromFileName } from './mime'

describe('mimeFromFileName', () => {
  it('maps known extensions case-insensitively', () => {
    expect(mimeFromFileName('a.png')).toBe('image/png')
    expect(mimeFromFileName('a.JPG')).toBe('image/jpeg')
    expect(mimeFromFileName('a.jpeg')).toBe('image/jpeg')
    expect(mimeFromFileName('a.gif')).toBe('image/gif')
    expect(mimeFromFileName('a.webp')).toBe('image/webp')
    expect(mimeFromFileName('a.bmp')).toBe('image/bmp')
    expect(mimeFromFileName('a.svg')).toBe('image/svg+xml')
    expect(mimeFromFileName('a.heic')).toBe('image/heic')
    expect(mimeFromFileName('a.mp4')).toBe('video/mp4')
    expect(mimeFromFileName('a.webm')).toBe('video/webm')
    expect(mimeFromFileName('a.mov')).toBe('video/quicktime')
    expect(mimeFromFileName('a.mp3')).toBe('audio/mpeg')
    expect(mimeFromFileName('a.m4a')).toBe('audio/mp4')
    expect(mimeFromFileName('a.ogg')).toBe('audio/ogg')
    expect(mimeFromFileName('a.wav')).toBe('audio/wav')
    expect(mimeFromFileName('a.pdf')).toBe('application/pdf')
    expect(mimeFromFileName('a.txt')).toBe('text/plain')
    expect(mimeFromFileName('a.md')).toBe('text/markdown')
    expect(mimeFromFileName('a.json')).toBe('application/json')
    expect(mimeFromFileName('a.zip')).toBe('application/zip')
    expect(mimeFromFileName('a.7z')).toBe('application/x-7z-compressed')
    expect(mimeFromFileName('a.rar')).toBe('application/vnd.rar')
    expect(mimeFromFileName('a.tar.gz')).toBe('application/gzip')
    expect(mimeFromFileName('a.doc')).toBe('application/msword')
    expect(mimeFromFileName('a.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(mimeFromFileName('a.xls')).toBe('application/vnd.ms-excel')
    expect(mimeFromFileName('a.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(mimeFromFileName('a.ppt')).toBe('application/vnd.ms-powerpoint')
    expect(mimeFromFileName('a.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(mimeFromFileName('a.csv')).toBe('text/csv')
  })

  it('uses the base name of a path', () => {
    expect(mimeFromFileName('C:\\Users\\me\\photo.png')).toBe('image/png')
    expect(mimeFromFileName('/tmp/dir.d/readme')).toBe('application/octet-stream')
  })

  it('defaults to application/octet-stream', () => {
    expect(mimeFromFileName('a.xyz')).toBe('application/octet-stream')
    expect(mimeFromFileName('Makefile')).toBe('application/octet-stream')
    expect(mimeFromFileName('')).toBe('application/octet-stream')
  })
})

describe('isImageMime', () => {
  it('accepts image types except svg', () => {
    expect(isImageMime('image/png')).toBe(true)
    expect(isImageMime('IMAGE/JPEG')).toBe(true)
    expect(isImageMime('image/svg+xml')).toBe(false)
    expect(isImageMime('video/mp4')).toBe(false)
    expect(isImageMime('application/octet-stream')).toBe(false)
  })
})

describe('extensionForMime', () => {
  it('reverses the mapping', () => {
    expect(extensionForMime('image/png')).toBe('png')
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('image/webp')).toBe('webp')
    expect(extensionForMime('application/pdf')).toBe('pdf')
  })

  it('ignores case and parameters', () => {
    expect(extensionForMime('Text/Plain; charset=utf-8')).toBe('txt')
  })

  it('defaults to bin', () => {
    expect(extensionForMime('application/x-unknown')).toBe('bin')
    expect(extensionForMime('')).toBe('bin')
  })
})

describe('fileName', () => {
  it('returns the base name for / and \\ separators', () => {
    expect(fileName('/home/me/a.txt')).toBe('a.txt')
    expect(fileName('C:\\Users\\me\\b.pdf')).toBe('b.pdf')
    expect(fileName('mixed/dir\\c.png')).toBe('c.png')
    expect(fileName('plain.md')).toBe('plain.md')
  })
})
