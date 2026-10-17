import { useSyncExternalStore } from 'react'
import NetInfo from '@react-native-community/netinfo'

// A device counts as offline only when it has no network connection at all (airplane mode,
// no WiFi/data). A connected-but-unreachable server is NOT offline: the server may live on
// the local network, so cache-first screens keep working and API errors surface as usual.
let offline = false
const listeners = new Set()

const getSnapshot = () => offline

const subscribe = (listener) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

// NetInfo calls the listener immediately with the current state, so there is no initial
// fetch to do and no race on cold start.
NetInfo.addEventListener((netState) => {
	const next = netState.isConnected === false
	if (next === offline) return
	offline = next
	listeners.forEach((listener) => listener())
})

export const useOffline = () => useSyncExternalStore(subscribe, getSnapshot)

export const getIsOffline = () => offline
