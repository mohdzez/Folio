import { useState, useEffect } from 'react'
import {
  signInAnonymously,
  signInWithRedirect,
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

  // Handle redirect result on app load
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

  return { user, loading, signInWithGoogle }
}
