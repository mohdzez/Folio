import { useState, useEffect } from 'react'
import {
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import type { AppUser } from '../types'

const LOCAL_USER_KEY = 'folio_local_user_id'

function getLocalUser(): AppUser {
  let uid = localStorage.getItem(LOCAL_USER_KEY)
  if (!uid) {
    uid = `local_${crypto.randomUUID()}`
    localStorage.setItem(LOCAL_USER_KEY, uid)
  }
  return { uid, isAnonymous: true, email: null }
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setUser(getLocalUser())
      setLoading(false)
      return
    }
    const firebaseAuth = auth

    // Handle any pending redirect sign-in result (runs in parallel, doesn't block)
    getRedirectResult(firebaseAuth).catch((e) => console.error('Redirect result error:', e))

    // Canonical Firebase Auth pattern: respond to auth state in onAuthStateChanged.
    // Firebase fires this exactly once on startup — with the persisted user (if any)
    // or with null (no user / first visit / explicit sign-out).
    // Calling signInAnonymously here is SAFE because onAuthStateChanged(null) only
    // fires when there is genuinely no authenticated user, never due to a race.
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      if (u) {
        setUser(u)
        setLoading(false)
      } else {
        // Truly no user — create an anonymous session
        try {
          await signInAnonymously(firebaseAuth)
          // onAuthStateChanged will fire again with the new anonymous user
        } catch (e) {
          console.error('Anonymous sign-in failed:', e)
          setUser(getLocalUser())
          setLoading(false)
        }
      }
    })

    return unsub
  }, [])

  const signInWithGoogle = async () => {
    if (!auth) return
    const provider = new GoogleAuthProvider()
    try {
      // Popup works reliably in PWA/mobile WebView contexts
      await signInWithPopup(auth, provider)
      // onAuthStateChanged fires automatically with the Google user
    } catch (e: any) {
      // If popup is blocked, fall back to redirect
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, provider)
      } else {
        console.error('Google sign-in error:', e)
      }
    }
  }

  const handleSignOut = async () => {
    if (!auth) {
      setUser(getLocalUser())
      return
    }
    await signOut(auth)
    // onAuthStateChanged will fire with null → auto-creates anonymous session
  }

  return { user, loading, signInWithGoogle, signOut: handleSignOut }
}
