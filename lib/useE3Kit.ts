'use client'

import { useState, useEffect, useRef } from 'react'
import type { EThree } from '@virgilsecurity/e3kit-browser'

export type E3KitState = {
  eThree: EThree | null
  ready: boolean
  error: string | null
}

/**
 * Initializes Virgil E3Kit for the given user and returns the instance once ready.
 * Handles registration (new user) and key restoration (returning user) automatically.
 * Safe to call on every page load — the underlying singleton is cached.
 */
export function useE3Kit(userId: string | null): E3KitState {
  const [state, setState] = useState<E3KitState>({ eThree: null, ready: false, error: null })
  const initRef = useRef(false)

  useEffect(() => {
    if (!userId || initRef.current) return
    initRef.current = true

    import('@/lib/e3kit')
      .then(({ initE3Kit }) => initE3Kit(userId))
      .then(eThree => setState({ eThree, ready: true, error: null }))
      .catch(err => setState(s => ({ ...s, error: String(err) })))
  }, [userId])

  return state
}
