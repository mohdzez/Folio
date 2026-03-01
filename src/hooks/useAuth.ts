import { useState, useEffect } from 'react'
import {
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Listen for auth state changes
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })

    // On mount: wait for Firebase Auth to finish loading stored credentials
    // BEFORE checking currentUser. Without authStateReady(), currentUser is
    // null during the async IndexedDB load and we'd incorrectly create a new
    // anonymous session (losing all tasks saved under the real UID).
    const init = async () => {
      try {
        // Wait for Firebase Auth to restore the persisted session
        await auth.authStateReady()

        // Check for any pending redirect sign-in result
        const result = await getRedirectResult(auth)
        if (result?.user) return // onAuthStateChanged will fire with the Google user
      } catch (e) {
        console.error('Auth init error:', e)
      }
      // Only sign in anonymously if still no user after credentials are loaded
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(console.error)
      }
    }
    init()

    return unsub
  }, [])

  const signInWithGoogle = async () => {
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
    await signOut(auth)
    await signInAnonymously(auth)
  }

  return { user, loading, signInWithGoogle, signOut: handleSignOut }
}
