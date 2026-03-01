import { initializeApp, getApps } from 'firebase/app'
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

// Replace with your Firebase project config
// Get this from: Firebase Console → Project Settings → Your apps → Web app
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// Explicitly set auth to persist in localStorage (survives app restarts)
setPersistence(auth, browserLocalPersistence).catch(console.error)

// Enable Firestore offline persistence (caches tasks locally)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.error('Firestore persistence error:', err)
  }
})

export const getMessagingInstance = async () => {
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}

export default app
