import * as FileSystem from 'expo-file-system'

// File identity for a downloaded song.
//
// The bitrate belongs here because the bytes depend on it — but ONLY for an explicit
// stream format. `urlStream` returns a plain `stream?id=X` for 'raw', letting the server
// pick, so the bitrate setting changes nothing about the file. Keying on it anyway would
// re-download the entire library, byte for byte, every time the slider moved.
//
// The server is deliberately NOT part of the key: the two configured servers are the same
// library behind two addresses, so the bytes are interchangeable.
export const songCacheKey = (songId, streamFormat, maxBitRate = 0) => {
	if (streamFormat !== 'raw' && maxBitRate > 0) return `${songId}.${streamFormat}-${maxBitRate}`
	return `${songId}.${streamFormat}`
}

// A file we could have written: `<id>.<format>` or `<id>.<format>-<bitrate>`.
// `.part` siblings are in-progress downloads and are handled separately.
export const isSongFileName = (file) => (
	typeof file === 'string' &&
	!file.endsWith('.part') &&
	/^[A-Za-z0-9._-]+\.[a-z0-9]+(-\d+)?$/i.test(file)
)

// Reverse of `songCacheKey`. Subsonic ids are alphanumeric/dashes (the same rule
// `urlStream` enforces), so the last dot is the format separator.
export const parseSongFileName = (file) => {
	if (!isSongFileName(file)) return null
	const match = /^(.+)\.([a-z0-9]+)(?:-(\d+))?$/i.exec(file)
	if (!match) return null
	const [, id, format, bitRate] = match
	if (!id || !format || !/^[a-zA-Z0-9-]+$/.test(id)) return null
	return { id, format, bitRate: bitRate ? parseInt(bitRate, 10) : 0 }
}

export const getSongsDir = () => `${FileSystem.documentDirectory}/cache/songs/`

export const getPathSong = (songId, streamFormat, maxBitRate = 0) => (
	`${getSongsDir()}${songCacheKey(songId, streamFormat, maxBitRate)}`
)
