import jsQR from 'jsqr'
import { decodeQrFromFile } from './scan-image'

vi.mock('jsqr', () => ({
  default: vi.fn(),
}))

const mockedJsQR = vi.mocked(jsQR)
const pixels = new Uint8ClampedArray(4 * 2 * 3)

// jsdom has no canvas: stub the bitmap decode and the 2D context.
beforeEach(() => {
  mockedJsQR.mockReset()
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: 2,
    height: 3,
    close: () => {},
  })))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
    getImageData: (_x: number, _y: number, width: number, height: number) => ({ data: pixels, width, height }),
  } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const file = new File(['png'], 'qr.png', { type: 'image/png' })

describe('decodeQrFromFile', () => {
  it('returns the decoded QR string', async () => {
    mockedJsQR.mockReturnValue({ data: 'gim-link:abc' } as ReturnType<typeof jsQR>)
    await expect(decodeQrFromFile(file)).resolves.toBe('gim-link:abc')
    expect(mockedJsQR).toHaveBeenCalledWith(pixels, 2, 3)
  })

  it('returns null when no QR code decodes', async () => {
    mockedJsQR.mockReturnValue(null)
    await expect(decodeQrFromFile(file)).resolves.toBeNull()
  })

  it('returns null when the file is not a readable image', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      throw new DOMException('bad image', 'InvalidStateError')
    }))
    await expect(decodeQrFromFile(file)).resolves.toBeNull()
    expect(mockedJsQR).not.toHaveBeenCalled()
  })
})
