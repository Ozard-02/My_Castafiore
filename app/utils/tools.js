import { getApi } from '~/utils/api'
import logger from '~/utils/logger'

export const shuffle = (array) => {
	return array.map(value => ({ value, sort: Math.random() }))
		.sort((a, b) => a.sort - b.sort)
		.map(({ value }) => value)
}

export const saveQueue = async (config, queue, index) => {
	if (!global.saveQueue) return
	// the id list travels in the query string: a 1000-track radio queue produced a multi-KB
	// URL that servers reject (414/431), so the feature silently did nothing. Cap it and say so.
	const MAX_IDS = 500
	const ids = queue.map(item => item.id)
	if (ids.length > MAX_IDS) logger.info('saveQueue', `queue of ${ids.length} truncated to ${MAX_IDS}`)
	await getApi(config, 'savePlayQueue', {
		id: ids.slice(0, MAX_IDS).join(','),
		current: queue[index]?.id || '',
	}).catch(() => { })
}