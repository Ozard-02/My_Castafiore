// The `id` carried by a getCoverArt URL. The download manager names cached cover files
// after it, so an offline lookup can find the artwork without re-deriving the id from the
// item. Kept in its own dependency-free module so both file-naming code and the pure
// offline selectors can share it without importing the React/player layers.
export const coverIdFromUrl = (url) => {
	if (typeof url !== 'string') return null
	const match = /[?&]id=([^&]+)/.exec(url)
	return match ? decodeURIComponent(match[1]) : null
}
