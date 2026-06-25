'use client'

import { useEffect, useState } from 'react'

/** ติดตามสถานะอินเทอร์เน็ตของเบราว์เซอร์ — ใช้แสดงหน้า "ไม่มีอินเทอร์เน็ต" แบบ full-screen */
export function useOnlineStatus(): boolean {
  // เริ่มต้นเป็น true เสมอ (รวม SSR) กัน flash หน้า offline ตอนโหลดครั้งแรกก่อนที่ browser
  // จะรายงานสถานะจริงให้ — แล้วค่อย sync กับ navigator.onLine จริงใน useEffect
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
