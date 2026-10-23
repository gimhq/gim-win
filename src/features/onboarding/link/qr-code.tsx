import { QRCodeSVG } from 'qrcode.react'

interface QrCodeProps {
  value: string
  label: string
}

/** The link code as a scannable QR on a white tile. */
export function QrCode({ value, label }: QrCodeProps) {
  return (
    <div className="self-center rounded-xl bg-white p-3">
      <QRCodeSVG value={value} size={220} role="img" aria-label={label} />
    </div>
  )
}
