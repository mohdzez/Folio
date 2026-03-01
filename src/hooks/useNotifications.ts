import { useState, useEffect, useCallback } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance } from '../lib/firebase'
import { saveSettings } from '../lib/firestore'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export function useNotifications(uid: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [fcmToken, setFcmToken] = useState<string | null>(null)

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted' && uid) {
      try {
        const messaging = await getMessagingInstance()
        if (!messaging) return
        const token = await getToken(messaging, { vapidKey: VAPID_KEY })
        setFcmToken(token)
        await saveSettings(uid, { fcmToken: token })
      } catch (e) {
        console.warn('FCM token error', e)
      }
    }
  }, [uid])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    getMessagingInstance().then((messaging) => {
      if (!messaging) return
      cleanup = onMessage(messaging, (payload) => {
        // Foreground message — show a local notification
        const { title = 'Folio', body = '' } = payload.notification ?? {}
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/folio-pwa/pwa-192x192.png' })
        }
      })
    })
    return () => cleanup?.()
  }, [])

  return { permission, fcmToken, requestPermission }
}
