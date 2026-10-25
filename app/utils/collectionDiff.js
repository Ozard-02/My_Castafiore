// Compare the fresh server list of a collection with the snapshot stored when it was
// downloaded. Order-only changes are intentionally ignored: they need no network traffic,
// and the offline order is refreshed on the next real sync.
export const collectionDiff = (expectedSongs, collection) => {
	const expected = (expectedSongs || []).filter((song) => song?.id)
	const expectedIds = expected.map((song) => song.id)
	const expectedSet = new Set(expectedIds)
	const stored = collection?.songIds || []
	const storedSet = new Set(stored)

	const toAdd = expected.filter((song) => !storedSet.has(song.id))
	const toRemove = stored.filter((id) => !expectedSet.has(id))

	return {
		toAdd,
		toRemove,
		ids: expectedIds,
		changed: toAdd.length > 0 || toRemove.length > 0,
	}
}
