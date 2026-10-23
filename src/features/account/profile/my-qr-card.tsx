import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** The plain Account ID as a QR code (contract C8). */
export function MyQrCard({ userId }: { userId: string }) {
  const { t } = useTranslation('account')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.qr.title')}</CardTitle>
        <CardDescription>{t('profile.qr.helper')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-block rounded-xl bg-white p-3">
          <QRCodeSVG value={userId} size={200} role="img" aria-label={t('profile.qr.title')} />
        </div>
      </CardContent>
    </Card>
  )
}
