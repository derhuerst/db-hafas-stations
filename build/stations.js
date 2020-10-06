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
const {Transform, pipeline: pump} = require('stream')
const progressStream = require('progress-stream')

const userAgent = 'db-hafas-stations build'
const throttled = withThrottling(dbProfile, 10, 1000) // 10 reqs/s)
const retryingThrottled = withRetrying(throttled, {
	retries: 1,
})
const hafas = createHafas(retryingThrottled, userAgent)

const leadingZeros = /^0+/
const parseStationId = (id) => {
	if (!id) throw new Error('invalid id: ' + id)
	id = id.replace(leadingZeros, '')
	return id.length < 6 ? '0'.repeat(6 - id.length) + id : id
}

const maxIterations = 30
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

const abortWithError = (err) => {
	console.error(err)
	process.exit(1)
}

const walk = createWalk(hafas)
const download = () => {
	const data = walk(berlinHbf, {parseStationId, concurrency: 5, stationLines: true})
	const weight = concurrentThrough.obj({maxConcurrency: 5}, computeWeight)
	const progess = progressStream({objectMode: true, speed: minute})

	data.on('stats', ({stopsAndStations}) => progess.setLength(stopsAndStations))
	data.on('hafas-error', console.error)

	return pump(
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
