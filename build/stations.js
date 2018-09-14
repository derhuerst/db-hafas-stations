'use strict'

const createWalk = require('hafas-discover-stations')
const createThrottledHafas = require('db-hafas/throttle')
const createEstimate = require('hafas-estimate-station-weight')
const weights = require('compute-db-station-weight/lib/weights')
const concurrentThrough = require('through2-concurrent')
const progressStream = require('progress-stream')
const pump = require('pump')

const throttledHafas = createThrottledHafas('db-hafas-stations build', 10, 1000) // 10 reqs/s
const walk = createWalk(throttledHafas)

const minute = 60 * 1000

const leadingZeros = /^0+/
const parseStationId = (id) => {
	if (!id) throw new Error('invalid id: ' + id)
	id = id.replace(leadingZeros, '')
	return id.length < 6 ? '0'.repeat(6 - id.length) + id : id
}

const maxIterations = 30
const weight0Msg = `\
has a weight of 0. Probably there are no departures here. Using weight 1.`

const estimateStationWeight = createEstimate(throttledHafas, weights)
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

const berlinHbf = '8011160'

const download = () => {
	const data = walk(berlinHbf, {parseStationId, concurrency: 5, stationLines: true})
	const weight = concurrentThrough.obj({maxConcurrency: 5}, computeWeight)
	const progess = progressStream({objectMode: true, speed: minute})

	data.on('stats', ({stations}) => progess.setLength(stations))

	return pump(data, weight, progess, (err) => {})
}

module.exports = download
