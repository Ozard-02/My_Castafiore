import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getColors } from 'react-native-image-colors'

import { urlCover, coverIdOf } from '~/utils/url'
import { getLocalCoverUri } from '~/utils/downloadManager'
import { getIsOffline } from '~/utils/offline'
import logger from '~/utils/logger'

// Player background palette: 6 colors, dark -> light, tuned for duty as a full-screen
// background under white text. The fBM shader maps noise n in [0,1] across the slots,
// so the numbers here are the visual identity of the whole player screen.
//
// Legibility is guaranteed statically instead of per frame: every color is clamped to
// MAX_LUMINANCE (WCAG relative luminance). White text needs the surface under it at
// L <= 0.183 for a 4.5:1 ratio; the 0.35 container fill multiplies the background by
// 0.65 and the shader dim by another ~0.85, so L <= 0.30 covers the worst case with
// margin. The palette lives on the GPU; nothing re-checks contrast at runtime.

export const PALETTE_SLOTS = 6

const MAX_LUMINANCE = 0.30
const MIN_MAX_LUMINANCE = 0.09
const DEDUPE_DISTANCE = 0.075
const CACHE_PREFIX = 'playerPalette:'

// Brand-ish deep reds; also the last resort when even the theme is unavailable.
export const FALLBACK_COLORS = ['#0d090a', '#2a1215', '#4a1418', '#6e1a22', '#95262f', '#c2454f']

// ---------------------------------------------------------------------------
// Color helpers (sRGB in, sRGB out; luminance in linear space)
// ---------------------------------------------------------------------------
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

// Accepts '#rgb', '#rrggbb', '#rrggbbaa' and '#aarrggbb' (AndroidX Palette formats its
// results with a leading alpha byte). Returns { r, g, b } in [0,1] or null.
export const hexToRgb = (hex) => {
	if (typeof hex !== 'string') return null
	let h = hex.trim().replace('#', '')
	if (h.length === 3) h = h.split('').map((c) => c + c).join('')
	if (h.length === 8) {
		if (h.startsWith('ff') || h.startsWith('FF')) h = h.slice(2)
		else h = h.slice(0, 6)
	}
	if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null
	return {
		r: parseInt(h.slice(0, 2), 16) / 255,
		g: parseInt(h.slice(2, 4), 16) / 255,
		b: parseInt(h.slice(4, 6), 16) / 255,
	}
}

export const rgbToHex = ({ r, g, b }) => {
	const to = (c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')
	return `#${to(r)}${to(g)}${to(b)}`
}

const relLuminance = ({ r, g, b }) => 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)

// Scale a color down (never up) along its linear RGB until its luminance sits at `max`.
const clampLuminance = (rgb, max) => {
	const lum = relLuminance(rgb)
	if (lum <= max || lum <= 0) return rgb
	const k = max / lum
	return {
		r: Math.min(1, linearToSrgb(srgbToLinear(rgb.r) * k)),
		g: Math.min(1, linearToSrgb(srgbToLinear(rgb.g) * k)),
		b: Math.min(1, linearToSrgb(srgbToLinear(rgb.b) * k)),
	}
}

// Near-black palettes have no visible bands once the dim layer sits on top: lift the
// whole ramp so its brightest color reaches the floor. Scaling linear RGB keeps the hue
// and hits the target luminance exactly (same trick as clampLuminance, upward).
const ensureSpread = (rgb) => {
	const max = Math.max(...rgb.map(relLuminance))
	if (max >= MIN_MAX_LUMINANCE) return rgb
	const k = (MIN_MAX_LUMINANCE * 1.6) / Math.max(max, 1e-6)
	return rgb.map((c) => ({
		r: Math.min(1, linearToSrgb(srgbToLinear(c.r) * k)),
		g: Math.min(1, linearToSrgb(srgbToLinear(c.g) * k)),
		b: Math.min(1, linearToSrgb(srgbToLinear(c.b) * k)),
	}))
}

const distance = (a, b) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
const mixRgb = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t })

// Turn any bag of colors into exactly PALETTE_SLOTS hues, dark -> light, each safe as
// a background under white text.
export const preparePalette = (hexes) => {
	let colors = (hexes || []).map(hexToRgb).filter(Boolean)

	// dedupe: swatches from a flat cover are often the same color twice
	const unique = []
	colors.forEach((c) => {
		if (!unique.some((u) => distance(u, c) < DEDUPE_DISTANCE)) unique.push(c)
	})
	colors = unique

	if (colors.length === 0) colors = FALLBACK_COLORS.map(hexToRgb)
	colors.sort((a, b) => relLuminance(a) - relLuminance(b))
	while (colors.length < 3) {
		const first = colors[0]
		const last = colors[colors.length - 1]
		colors.splice(1, 0, mixRgb(first, last, 0.5))
	}

	colors = colors.map((c) => clampLuminance(c, MAX_LUMINANCE))
	colors = ensureSpread(colors).map((c) => clampLuminance(c, MAX_LUMINANCE))

	// resample evenly to exactly PALETTE_SLOTS slots
	const out = []
	for (let i = 0; i < PALETTE_SLOTS; i++) {
		const t = (i * (colors.length - 1)) / (PALETTE_SLOTS - 1)
		const lo = Math.floor(t)
		const hi = Math.min(colors.length - 1, lo + 1)
		out.push(rgbToHex(mixRgb(colors[lo], colors[hi], t - lo)))
	}
	return out
}

// Dark -> light ramp around the active player accent, so "background on, palette not
// ready yet" (and extraction failure) still look intentional.
export const themedPalette = (theme) => {
	const base = hexToRgb(theme?.playerBackground) || hexToRgb(theme?.primaryBack) || hexToRgb('#1e1e1e')
	const white = { r: 1, g: 1, b: 1 }
	return preparePalette([
		rgbToHex(mixRgb(base, { r: 0, g: 0, b: 0 }, 0.55)),
		rgbToHex(base),
		rgbToHex(mixRgb(base, white, 0.45)),
	])
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------
// Swatch preference order: muted/vibrant first — `dominant` and `average` are often
// muddy greys that flatten the ramp.
const SWATCH_KEYS = ['darkVibrant', 'vibrant', 'darkMuted', 'muted', 'lightVibrant', 'lightMuted', 'dominant', 'average']

const extractPalette = async (config, song, coverId) => {
	const local = getLocalCoverUri(coverId)
	const source = local || (getIsOffline() ? null : urlCover(config, song, 150))
	if (!source) return null
	const result = await getColors(source, {
		fallback: '#000000',
		cache: true,
		key: `palette:${coverId}`,
		pixelSpacing: 10,
		quality: 'low',
	})
	const hexes = SWATCH_KEYS.map((key) => result?.[key]).filter((c) => typeof c === 'string' && c !== '#000000')
	const palette = preparePalette(hexes)
	logger.info('playerPalette', `extracted ${coverId}: ${palette.join(' ')}`)
	return palette
}

// Cached palettes load instantly (no flash of the fallback ramp while the cover is
// fetched), then the fresh extraction overwrites them off the same render pass.
export const usePlayerPalette = (config, songInfo, enabled = true) => {
	const [palette, setPalette] = React.useState(null)
	const coverId = enabled && songInfo ? coverIdOf(config, songInfo) : null

	React.useEffect(() => {
		if (!coverId) {
			setPalette(null)
			return
		}
		let cancelled = false

		const run = async () => {
			try {
				const raw = await AsyncStorage.getItem(CACHE_PREFIX + coverId)
				if (raw) {
					const cached = JSON.parse(raw)
					if (!cancelled && Array.isArray(cached) && cached.length === PALETTE_SLOTS) setPalette(cached)
				}
			} catch (error) {
				logger.error('playerPalette', `cache read: ${error?.message || error}`)
			}
			try {
				const fresh = await extractPalette(config, songInfo, coverId)
				if (fresh && !cancelled) {
					setPalette(fresh)
					AsyncStorage.setItem(CACHE_PREFIX + coverId, JSON.stringify(fresh)).catch(() => { })
				}
			} catch (error) {
				logger.error('playerPalette', `extract: ${error?.message || error}`)
			}
		}

		run()
		return () => { cancelled = true }
		// songInfo is captured by reference on purpose: the effect re-runs per cover, not
		// per render of the player.
	}, [coverId])

	return palette
}
