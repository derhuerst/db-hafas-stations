'use strict'

const withThrottling = require('hafas-client/throttle')
const withRetrying = require('hafas-client/retry')
const createHafas = require('hafas-client')
const dbProfile = require('hafas-client/p/db')
const createWalk = require('hafas-discover-stations')
const createEstimate = require('hafas-estimate-station-weight')
const weights = require('compute-db-station-weight/lib/weights')
const omit = require('lodash/omit')
const concurrentThrough = require('through2-concurrent')
const {promisify} = require('util')
const {PassThrough, Transform, pipeline} = require('stream')
const findStations = require('hafas-find-stations')
const progressStream = require('progress-stream')

const pPipeline = promisify(pipeline)

const userAgent = 'db-hafas-stations build'
const throttled = withThrottling(dbProfile, 3, 1000) // 3 reqs/s)
const retryingThrottled = withRetrying(throttled, {
	retries: 2,
})
const hafas = createHafas(retryingThrottled, userAgent)

const leadingZeros = /^0+/
const parseStationId = (id) => {
	if (!id) throw new Error('invalid id: ' + id)
	id = id.replace(leadingZeros, '')
	return id.length < 6 ? '0'.repeat(6 - id.length) + id : id
}

const maxIterations = 10
const weight0Msg = `\
has a weight of 0. Probably there are no departures here. Using weight 1.`

const estimateStationWeight = createEstimate(hafas, weights)
const computeWeight = (s, _, cb) => {
	estimateStationWeight(s.id, maxIterations)
	.then(weight => {
		if (weight === 0 || weight === null) {
			console.error(s.id, s.name, weight0Msg)
			weight = 1
		}
		s.weight = weight
		cb(null, s)
	})
	.catch((err) => {
		if (err.isHafasError) {
			console.error(s.id, s.name, err && err.message || (err + ''))
			cb(null)
		} else cb(err)
	})
}

const fixStopsWithoutStation = (s, _, cb) => {
	if (s.type !== 'stop') return cb(null, s)
	return cb(null, {
		type: 'station',
		...omit(s, ['type', 'station'])
	})
}

const berlinHbf = '8011160'
const minute = 60 * 1000
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

// todo: clean this up
const download = () => {
	const seenStopIds = new Set()
	const data = new PassThrough({
		objectMode: true,
	})

	console.info('searching stations using hafas-find-stations')
	findStations(hafas, bbox, {concurrency: 10}, (err, stop) => {
		if (err) console.error(err)
		if (stop) {
			seenStopIds.add(stop.id)
			data.write(stop)
		}
	})
	.then(() => {
		const firstStopId = seenStopIds.values().next().value

		console.info('searching stations using hafas-discover-stations')
		const walk = createWalk(hafas)
		const walker = walk(firstStopId)
		for (const stopId of seenStopIds) walker.markAsVisited(stopId)

		walker.on('stats', ({stopsAndStations}) => progess.setLength(stopsAndStations))
		walker.on('hafas-error', console.error)

		return pPipeline(walker, data)
	})
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})

	const weight = concurrentThrough.obj({maxConcurrency: 5}, computeWeight)
	const progess = progressStream({objectMode: true, speed: minute})

	return pipeline(
		data,
		weight,
		new Transform({
			objectMode: true,
			transform: fixStopsWithoutStation
		}),
		progess,
		abortWithError
	)
}

module.exports = download
