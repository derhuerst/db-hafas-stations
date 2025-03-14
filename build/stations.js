import createWalk from 'hafas-discover-stations'
import omit from 'lodash/omit.js'
import {promisify} from 'node:util'
import {PassThrough, Transform} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import findStations from 'hafas-find-stations'
import {stringify} from 'ndjson'
import {hafas} from './hafas.js'

const fixStopsWithoutStation = (s, _, cb) => {
	if (s.type !== 'stop') return cb(null, s)
	return cb(null, {
		type: 'station',
		...omit(s, ['type', 'station'])
	})
}

const bbox = {
	north: 54.888,
	west: 5.889,
	south: 47.188,
	east: 15.106,
}

const seenStopIds = new Set()
const data = new PassThrough({
	objectMode: true,
})

console.error('searching stations using hafas-find-stations')
await findStations(hafas, bbox, {concurrency: 10}, (err, stop) => {
	if (err) console.error(err)
	if (stop) {
		seenStopIds.add(stop.id)
		data.write(stop)
	}
})

{
	const firstStopId = seenStopIds.values().next().value

	console.error('searching stations using hafas-discover-stations')
	const walk = createWalk(hafas)
	const walker = walk(firstStopId)
	for (const stopId of seenStopIds) walker.markAsVisited(stopId)

	walker.on('hafas-error', console.error)

	await pipeline(walker, data)
}

await pipeline(
	data,
	stringify(),
	process.stdout,
)
