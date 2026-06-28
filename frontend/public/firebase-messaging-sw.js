// Firebase Cloud Messaging Service Worker
// ทำหน้าที่รับ Push Notification ตอนที่ "ปิดเว็บ/แท็บอยู่" หรือ "อยู่หน้าอื่นที่ไม่ใช่แท็บนี้"
// (ตอนเปิดเว็บอยู่ปกติ Firebase SDK จะส่ง event ให้ onMessage() ในแอปจัดการเอง ไม่ผ่านไฟล์นี้)
//
// ข้อจำกัดสำคัญ: ไฟล์นี้เป็น static file รันนอกบริบทของ Next.js จึงอ่าน process.env ไม่ได้
// ต้องกรอกค่า Firebase config ตรงนี้ "ซ้ำอีกครั้ง" ให้เหมือนกับค่าใน .env.local
// (เป็น public config ไม่ใช่ secret key จึงใส่ตรงๆ ในไฟล์ที่เบราว์เซอร์โหลดได้ ไม่มีความเสี่ยงด้านความปลอดภัย)

importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js")

firebase.initializeApp({
  apiKey: "AIzaSyBj0Rjp3R4vYL0JqXfMCgv_kEMV6blpMck",
  authDomain: "nutrismart-web.firebaseapp.com",
  projectId: "nutrismart-web",
  storageBucket: "nutrismart-web.firebasestorage.app",
  messagingSenderId: "622410259106",
  appId: "1:622410259106:web:eb6f7bec049224c5a015fb",
})

const messaging = firebase.messaging()

// แสดง notification เมื่อข้อความมาถึงตอนแท็บ/เบราว์เซอร์ไม่ได้โฟกัสอยู่
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "NutriSmart"
  const body = payload.notification?.body || ""

  self.registration.showNotification(title, {
    body,
    icon: "/icons/Logo.png",
    badge: "/icons/Logo.png",
    data: payload.data,
  })
})

// คลิก notification แล้วเปิด/โฟกัสแท็บแอป
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      const url = "/dashboard"
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
