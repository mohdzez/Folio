import { initializeApp, getApps } from 'firebase/app'
import { Auth, getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { Firestore, initializeFirestore, persistentLocalCache, CACHE_SIZE_UNLIMITED } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
)

const app = isFirebaseConfigured
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null

export const auth: Auth | null = app ? getAuth(app) : null

// Explicitly persist auth across app restarts (localStorage survives PWA close)
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(console.error)
}

// Initialize Firestore with persistent local cache (survives app restarts)
// Using modern API (initializeFirestore) instead of deprecated enableIndexedDbPersistence
export const db: Firestore | null = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
    })
  : null

export const getMessagingInstance = async () => {
  if (!app) return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}

export default app
