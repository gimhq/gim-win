import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

// Placeholder until the onboarding and chat routes land; the English literal
// is acceptable in this scaffold only.
function IndexPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>gim</CardTitle>
          <CardDescription>Desktop client scaffold.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button">Get started</Button>
        </CardContent>
      </Card>
    </main>
  )
}
