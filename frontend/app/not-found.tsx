'use client'

import { useRouter } from 'next/navigation'
import { BroccoliMascot, ErrorScreen } from '@/components/ui/error-mascots'

export default function NotFound() {
  const router = useRouter()
  return (
    <ErrorScreen
      mascot={<BroccoliMascot />}
      badgeText="Error 404"
      badgeBg="#E8F5E9"
      badgeColor="#2E7D32"
      title="หาไม่เจอเลยอ่ะ~ 🥹"
      subtitle="บร็อคโคลี่หลงทางแล้ว ไม่รู้จะไปหาหน้านั้นได้ที่ไหน"
      actions={[
        { label: '🏠 กลับบ้านเลย!', variant: 'primary', onClick: () => router.push('/dashboard') },
      ]}
    />
  )
}
