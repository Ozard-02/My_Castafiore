import { useCachedFirst } from '~/utils/api'
import { syncLocalStarred } from '~/utils/downloadManager'

// Single source of truth for favorited song ids, reactive to star toggles via the
// getStarred2 cache + updateApi subscription. Returns a Set; use `.has(id)`.
// Also refreshes the favourite flag stored on downloaded songs, so offline rows/players
// read the right state without a network call.
export const useStarredIds = () => {
	const [ids] = useCachedFirst(new Set(), 'getStarred2', null, (json, setData) => {
		if (!json?.starred2?.song) return
		const next = new Set(json.starred2.song.map(song => song.id))
		setData(next)
		syncLocalStarred(next)
	})
	return ids
}