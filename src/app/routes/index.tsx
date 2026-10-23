import { createFileRoute, redirect } from '@tanstack/react-router'
import { startup } from '@/lib/api'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const info = await startup()
    throw redirect({
      to: info.clientReady && info.session
        ? '/chats'
        : '/onboarding',
    })
  },
  component: () => null,
})
