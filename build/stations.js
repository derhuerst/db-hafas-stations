'use strict'

const createWalk = require('hafas-discover-stations')
const omit = require('lodash/omit')
const {promisify} = require('util')
const {PassThrough, Transform, pipeline} = require('stream')
const findStations = require('hafas-find-stations')
const {stringify} = require('ndjson')
const hafas = require('./hafas')

const pPipeline = promisify(pipeline)

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

const abortWithError = (err) => {
	console.error(err)
	process.exit(1)
}

const seenStopIds = new Set()
const data = new PassThrough({
	objectMode: true,
})

console.error('searching stations using hafas-find-stations')
findStations(hafas, bbox, {concurrency: 10}, (err, stop) => {
	if (err) console.error(err)
	if (stop) {
		seenStopIds.add(stop.id)
		data.write(stop)
	}
})
.then(() => {
	const firstStopId = seenStopIds.values().next().value

	console.error('searching stations using hafas-discover-stations')
	const walk = createWalk(hafas)
	const walker = walk(firstStopId)
	for (const stopId of seenStopIds) walker.markAsVisited(stopId)

	walker.on('hafas-error', console.error)

	return pPipeline(walker, data)
})
.catch((err) => {
	console.error(err)
	process.exit(1)
})

return pipeline(
	data,
	stringify(),
	process.stdout,
	abortWithError
)
