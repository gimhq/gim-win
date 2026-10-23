import jsQR from 'jsqr'
import { decodeQrFromImage } from './qr'

vi.mock('jsqr', () => ({
  default: vi.fn(),
}))

const mockedJsQR = vi.mocked(jsQR)
const pixels = new Uint8ClampedArray(4 * 3 * 2)
const drawImage = vi.fn()
const getImageData = vi.fn(() => ({ data: pixels }))

class FakeImage {
  static fail = false
  naturalWidth = 3
  naturalHeight = 2
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  get src(): string {
    return ''
  }

  set src(_value: string) {
    queueMicrotask(() => FakeImage.fail
      ? this.onerror?.()
      : this.onload?.())
  }
}

beforeEach(() => {
  FakeImage.fail = false
  mockedJsQR.mockReset()
  drawImage.mockClear()
  getImageData.mockClear()
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:qr'),
    revokeObjectURL: vi.fn(),
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    getImageData,
  } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('decodeQrFromImage', () => {
  it('returns the decoded text of the image pixels', async () => {
    mockedJsQR.mockReturnValue({ data: 'hello' } as ReturnType<typeof jsQR>)
    await expect(decodeQrFromImage(new Blob(['png']))).resolves.toBe('hello')
    expect(getImageData).toHaveBeenCalledWith(0, 0, 3, 2)
    expect(mockedJsQR).toHaveBeenCalledWith(pixels, 3, 2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qr')
  })

  it('returns null when the image has no code', async () => {
    mockedJsQR.mockReturnValue(null)
    await expect(decodeQrFromImage(new Blob(['png']))).resolves.toBeNull()
  })

  it('returns null when the file is not an image', async () => {
    FakeImage.fail = true
    await expect(decodeQrFromImage(new Blob(['text']))).resolves.toBeNull()
    expect(mockedJsQR).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qr')
  })
})
