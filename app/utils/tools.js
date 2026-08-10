import { getApi } from '~/utils/api'

export const shuffle = (array) => {
	return array.map(value => ({ value, sort: Math.random() }))
		.sort((a, b) => a.sort - b.sort)
		.map(({ value }) => value)
}

export const saveQueue = async (config, queue, index) => {
	if (!global.saveQueue) return
	await getApi(config, 'savePlayQueue', {
		id: queue.map(item => item.id).join(','),
		current: queue[index]?.id || '',
	})
}