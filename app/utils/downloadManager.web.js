import { useSyncExternalStore } from 'react'

const listeners = new Set()
let state = { queue: [], index: {}, collections: {} }

const subscribe = (listener) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

const getSnapshot = () => state

export const useDownloads = () => useSyncExternalStore(subscribe, getSnapshot)

export const formatSpeed = (bytesPerSecond) => {
	if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
	if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`
	return `${bytesPerSecond} B/s`
}

export const formatBytes = (bytes) => {
	if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
	return `${bytes} B`
}

// Web offline playback is handled by the service worker; no manual manager.
export const initDownloads = async () => { }
export const saveDownloads = async () => { }
export const enqueueSong = async () => { }
export const enqueueCollection = async () => { }
export const pauseDownload = async () => { }
export const resumeDownload = async () => { }
export const retryDownload = async () => { }
export const cancelDownload = async () => { }
export const cancelCollection = async () => { }
export const resumeCollection = async () => { }
export const removeSong = async () => { }
export const removeSource = async () => { }
export const clearAllDownloads = async () => { }
export const getDownloadSpeed = () => 0
export const getActiveDownloadCount = () => 0
export const getCollectionState = () => ({ status: 'none', progress: 0, completedSongs: 0, totalSongs: 0 })
export const getDownloadedSongs = () => []
export const getSongState = () => ({ status: 'none', progress: 0 })
