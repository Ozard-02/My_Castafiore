import { useSyncExternalStore } from 'react'

// Web: the service worker already keeps the app usable offline, so this only reports
// navigator.onLine for the screens that want to know.
let offline = typeof navigator !== 'undefined' && navigator.onLine === false
const listeners = new Set()

const getSnapshot = () => offline

const subscribe = (listener) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

const update = () => {
	const next = navigator.onLine === false
	if (next === offline) return
	offline = next
	listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', update)
	window.addEventListener('offline', update)
}

export const useOffline = () => useSyncExternalStore(subscribe, getSnapshot)

export const getIsOffline = () => offline
