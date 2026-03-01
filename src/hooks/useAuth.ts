import { useState, useEffect } from 'react'
import {
  signInAnonymously,
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
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    getRedirectResult(auth).catch(console.error)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      signInAnonymously(auth).catch(console.error)
    }
  }, [loading, user])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(auth, provider)
  }

  const handleSignOut = async () => {
    await signOut(auth)
    // Re-sign in anonymously so the app still works
    await signInAnonymously(auth)
  }

  return { user, loading, signInWithGoogle, signOut: handleSignOut }
}
