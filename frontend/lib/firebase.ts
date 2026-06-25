// Firebase Cloud Messaging (Web Push) — ฝั่ง client
//
// ต้องตั้งค่า NEXT_PUBLIC_FIREBASE_* ใน .env.local ก่อน (ดูค่าได้จาก Firebase Console >
// Project Settings > General > Your apps > Web app) ไม่งั้น requestNotificationPermission()
// จะคืน null เสมอ

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

let app: FirebaseApp | null = null

function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null
  if (app) return app
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
  return app
}

export type PushPermissionResult =
  | { status: "granted"; token: string }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "not-configured" }

/**
 * ขอสิทธิ์แจ้งเตือนจากเบราว์เซอร์ + ลงทะเบียน Service Worker + ขอ FCM token
 * เรียกจากปุ่ม "เปิดรับการแจ้งเตือน" ในหน้าตั้งค่า — ต้องเป็น user gesture (คลิกปุ่ม) เท่านั้น
 * เบราว์เซอร์ส่วนใหญ่ไม่ยอมให้ขอสิทธิ์ notification อัตโนมัติตอนโหลดหน้า
 */
export async function requestNotificationPermission(): Promise<PushPermissionResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { status: "unsupported" }
  }

  const supported = await isSupported().catch(() => false)
  if (!supported) return { status: "unsupported" }

  const firebaseApp = getFirebaseApp()
  if (!firebaseApp || !VAPID_KEY) return { status: "not-configured" }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { status: "denied" }

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
    const messaging: Messaging = getMessaging(firebaseApp)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return { status: "denied" }
    return { status: "granted", token }
  } catch (err) {
    console.error("[firebase] Failed to get FCM token:", err)
    return { status: "denied" }
  }
}

/** เช็คสถานะสิทธิ์ปัจจุบันแบบไม่ขอ permission ใหม่ — ใช้แสดงผล UI ตอนโหลดหน้า */
export function getNotificationPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return Notification.permission
}
