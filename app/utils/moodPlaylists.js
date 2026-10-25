import AsyncStorage from '@react-native-async-storage/async-storage'

import { getApi } from '~/utils/api'
import { getExcludedSongIds } from '~/utils/exclusions'
import { getIsOffline } from '~/utils/offline'
import logger from '~/utils/logger'

// A mix is a generated list of songs, not a server playlist. The catalog is deliberately
// larger than the five slots per period: every expiry picks a new random subset, so the
// Home page keeps changing without any per-theme settings.
const THEMES = [
	{
		id: 'chill',
		moods: ['chill', 'calm', 'relaxed', 'mellow', 'peaceful', 'soft'],
		genres: ['ambient', 'downtempo', 'acoustic', 'chillout', 'lounge'],
		bpm: [0, 95],
	},
	{
		id: 'energy',
		moods: ['energetic', 'energizing', 'upbeat', 'powerful', 'intense'],
		genres: ['dance', 'edm', 'electronic', 'electro', 'house', 'techno'],
		bpm: [115, 220],
	},
	{
		id: 'focus',
		moods: ['focus', 'focused', 'concentration', 'study', 'calm'],
		genres: ['ambient', 'classical', 'instrumental', 'piano', 'soundtrack'],
		bpm: [0, 110],
	},
	{
		id: 'party',
		moods: ['party', 'fun', 'happy', 'upbeat', 'celebratory'],
		genres: ['dance', 'pop', 'disco', 'funk', 'house', 'hip-hop'],
		bpm: [110, 220],
	},
	{
		id: 'melancholy',
		moods: ['melancholy', 'sad', 'emotional', 'moody', 'dark'],
		genres: ['indie', 'alternative', 'singer-songwriter', 'blues'],
		bpm: [0, 110],
	},
	{
		id: 'romantic',
		moods: ['romantic', 'love', 'sensual', 'tender', 'warm'],
		genres: ['r&b', 'soul', 'pop', 'jazz', 'acoustic'],
		bpm: [55, 120],
	},
	{
		id: 'workout',
		moods: ['energetic', 'powerful', 'motivational', 'intense'],
		genres: ['hip-hop', 'rock', 'electronic', 'dance'],
		bpm: [120, 220],
	},
	{
		id: 'sleep',
		moods: ['sleep', 'sleepy', 'dreamy', 'calm', 'ambient'],
		genres: ['ambient', 'classical', 'piano', 'new age'],
		bpm: [0, 75],
	},
	{
		id: 'acoustic',
		moods: ['acoustic', 'warm', 'intimate', 'organic'],
		genres: ['folk', 'acoustic', 'singer-songwriter', 'country'],
		bpm: [60, 140],
	},
	{
		id: 'electronic',
		moods: ['electronic', 'futuristic', 'hypnotic'],
		genres: ['electronic', 'edm', 'synth', 'techno', 'house'],
		bpm: [100, 220],
	},
	{
		id: 'throwback',
		moods: ['nostalgic', 'retro', 'throwback'],
		genres: ['oldies', 'classic rock', 'disco', 'funk', 'soul'],
		year: [1900, 1999],
	},
	{
		id: 'discovery',
		moods: ['discovery', 'fresh'],
		genres: [],
		recent: true,
	},
	{
		id: 'upbeat',
		moods: ['upbeat', 'happy', 'joyful', 'positive'],
		genres: ['pop', 'dance', 'funk', 'soul'],
		bpm: [110, 220],
	},
	{
		id: 'ambient',
		moods: ['ambient', 'atmospheric', 'dreamy', 'ethereal'],
		genres: ['ambient', 'drone', 'new age', 'electronic'],
		bpm: [0, 100],
	},
	{
		id: 'jazz',
		moods: ['jazzy', 'smooth', 'cool'],
		genres: ['jazz', 'blues', 'swing', 'bossa nova'],
		bpm: [50, 160],
	},
	{
		id: 'rock',
		moods: ['rebellious', 'powerful', 'intense'],
		genres: ['rock', 'metal', 'punk', 'alternative'],
		bpm: [90, 220],
	},
]

const MIXES_PER_GROUP = 5
const SONGS_PER_MIX = 50
const POOL_SIZE = 500
const POOL_TTL_MS = 60_000

const normalize = (value) => String(value ?? '').trim().toLowerCase()
const listify = (value) => {
	if (Array.isArray(value)) return value
	return value === undefined || value === null || value === '' ? [] : [value]
}

const namesOf = (value) => listify(value)
	.map((item) => (typeof item === 'string' ? item : item?.name))
	.map(normalize)
	.filter(Boolean)

const songGenres = (song) => [
	...namesOf(song?.genre),
	...namesOf(song?.genres),
]

const songMoods = (song) => [
	...namesOf(song?.moods),
	...namesOf(song?.mood),
]

const hasOverlap = (values, targets) => {
	if (!values.length || !targets?.length) return false
	return values.some((value) => targets.some((target) => (
		value === target || value.includes(target) || target.includes(value)
	)))
}

const matchScore = (song, theme) => {
	const moods = songMoods(song)
	const genres = songGenres(song)
	const bpm = Number(song?.bpm)
	const year = Number(song?.year)
	const hasBpm = Number.isFinite(bpm) && bpm > 0
	const hasYear = Number.isFinite(year) && year > 0
	let score = 0

	if (hasOverlap(moods, theme.moods)) score += 3
	if (hasOverlap(genres, theme.genres)) score += 2
	if (theme.bpm && hasBpm && bpm >= theme.bpm[0] && bpm <= theme.bpm[1]) score += 1
	if (theme.year && hasYear && year >= theme.year[0] && year <= theme.year[1]) score += 1
	if (theme.recent && hasYear && year >= new Date().getFullYear() - 2) score += 2

	return score
}

const hashString = (value) => {
	let hash = 2166136261
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

const mulberry32 = (seed) => {
	let value = seed
	return () => {
		value |= 0
		value = (value + 0x6D2B79F5) | 0
		let t = Math.imul(value ^ (value >>> 15), 1 | value)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const seededShuffle = (items, seed) => {
	const random = mulberry32(hashString(seed))
	const result = [...items]
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		const current = result[i]
		result[i] = result[j]
		result[j] = current
	}
	return result
}

const dayKey = (date = new Date()) => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

// ISO week, Monday-based, so the weekly mixes refresh at the start of the week.
const weekKey = (date = new Date()) => {
	const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
	const day = utc.getUTCDay() || 7
	utc.setUTCDate(utc.getUTCDate() + 4 - day)
	const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
	const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7)
	return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const getPeriodKey = (group, date = new Date()) => (
	group === 'weekly' ? weekKey(date) : dayKey(date)
)

export const msUntilNextPeriod = (group, date = new Date()) => {
	const next = new Date(date)
	if (group === 'weekly') {
		const day = date.getDay() || 7
		const daysUntilMonday = (8 - day) % 7 || 7
		next.setDate(date.getDate() + daysUntilMonday)
	} else {
		next.setDate(date.getDate() + 1)
	}
	next.setHours(0, 0, 0, 0)
	// A little slack so the timer never fires a millisecond before the key changes.
	return Math.max(1000, next.getTime() - date.getTime() + 1000)
}

const cacheKey = (config, group) => (
	`moodMixes:${config?.url || ''}:${config?.username || ''}:${group}`
)

const readCache = async (config, group) => {
	try {
		const raw = await AsyncStorage.getItem(cacheKey(config, group))
		return raw ? JSON.parse(raw) : null
	} catch (error) {
		logger.error('moodPlaylists', `Unable to read ${group} cache`, error)
		return null
	}
}

const writeCache = async (config, group, value) => {
	try {
		await AsyncStorage.setItem(cacheKey(config, group), JSON.stringify(value))
	} catch (error) {
		logger.error('moodPlaylists', `Unable to write ${group} cache`, error)
	}
}

const fetchPool = async (config) => {
	const songs = new Map()
	// getRandomSongs has no offset; repeating it is the only way to widen a small or
	// heavily filtered sample. Dedupe by id as the server may return the same track twice.
	for (let attempt = 0; attempt < 3; attempt++) {
		const json = await getApi(config, 'getRandomSongs', { size: POOL_SIZE })
		const list = listify(json?.randomSongs?.song)
		list.forEach((song) => {
			if (song?.id) songs.set(song.id, song)
		})
		if (list.length < POOL_SIZE || songs.size >= POOL_SIZE) break
	}
	let pool = [...songs.values()]
	const excluded = await getExcludedSongIds(config)
	if (excluded.size) pool = pool.filter((song) => !excluded.has(song.id))
	return pool
}

let poolCache = { key: null, at: 0, promise: null }

const getPool = (config) => {
	const key = `${config?.url || ''}:${config?.username || ''}`
	if (poolCache.key === key && poolCache.promise && Date.now() - poolCache.at < POOL_TTL_MS) {
		return poolCache.promise
	}
	const promise = fetchPool(config).catch((error) => {
		if (poolCache.promise === promise) poolCache = { key: null, at: 0, promise: null }
		throw error
	})
	poolCache = { key, at: Date.now(), promise }
	return promise
}

const pickThemes = (config, group, periodKey, blocked) => {
	const seed = `${config?.url || ''}:${config?.username || ''}:${group}:${periodKey}`
	let themes = seededShuffle(THEMES, seed).filter((theme) => !blocked.has(theme.id))
	if (themes.length < MIXES_PER_GROUP) themes = seededShuffle(THEMES, seed)
	return themes.slice(0, MIXES_PER_GROUP)
}

const buildPlaylists = (pool, themes, group, periodKey) => {
	const used = new Set()
	return themes.map((theme, index) => {
		const seed = `${group}:${periodKey}:${theme.id}:${index}`
		const matched = pool.filter((song) => !used.has(song.id) && matchScore(song, theme) > 0)
		let songs = seededShuffle(matched, seed).slice(0, SONGS_PER_MIX)
		if (songs.length < SONGS_PER_MIX) {
			// A rare theme must not produce a short list: fill with the rest of the pool,
			// allowing a song already used by another mix but never twice in this one.
			const picked = new Set(songs.map((song) => song.id))
			const fill = seededShuffle(pool.filter((song) => !picked.has(song.id)), `${seed}:fill`)
			songs = songs.concat(fill.slice(0, SONGS_PER_MIX - songs.length))
		}
		songs.forEach((song) => used.add(song.id))
		return {
			id: `${group}-${index + 1}`,
			themeId: theme.id,
			songs,
		}
	}).filter((mix) => mix.songs.length > 0)
}

const generateGroup = async (config, group, periodKey) => {
	const otherGroup = group === 'weekly' ? 'daily' : 'weekly'
	const other = await readCache(config, otherGroup)
	const blocked = new Set()
	if (other?.periodKey === getPeriodKey(otherGroup) && Array.isArray(other.playlists)) {
		other.playlists.forEach((mix) => blocked.add(mix.themeId))
	}
	const pool = await getPool(config)
	const themes = pickThemes(config, group, periodKey, blocked)
	return {
		periodKey,
		group,
		playlists: buildPlaylists(pool, themes, group, periodKey),
	}
}

// Generating both groups at once would let them read an empty other-cache and pick the same
// themes. Serialising generation makes the second group see the first group's fresh cache.
let generationQueue = Promise.resolve()

const enqueue = (task) => {
	const next = generationQueue.then(task, task)
	generationQueue = next.catch(() => { })
	return next
}

export const getMoodMixes = async (config, group) => {
	if (!config?.url || !config?.query) return []
	if (getIsOffline()) return []

	const periodKey = getPeriodKey(group)
	const cached = await readCache(config, group)
	if (cached?.periodKey === periodKey && cached.playlists?.length) return cached.playlists

	try {
		const result = await enqueue(async () => {
			// Another call may have generated this group while we waited in the queue.
			const current = await readCache(config, group)
			if (current?.periodKey === periodKey && current.playlists?.length) return current
			const generated = await generateGroup(config, group, periodKey)
			await writeCache(config, group, generated)
			return generated
		})
		return result.playlists
	} catch (error) {
		logger.error('moodPlaylists', `Unable to generate ${group} mixes`, error)
		return cached?.playlists || []
	}
}
