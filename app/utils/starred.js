import { useCachedFirst } from '~/utils/api'

// Single source of truth for favorited song ids, reactive to star toggles via the
// getStarred2 cache + updateApi subscription. Returns a Set; use `.has(id)`.
export const useStarredIds = () => {
	const [ids] = useCachedFirst(new Set(), 'getStarred2', null, (json, setData) => {
		setData(new Set((json?.starred2?.song || []).map(song => song.id)))
	})
	return ids
}