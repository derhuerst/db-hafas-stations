'use strict'

const createWalk = require('hafas-discover-stations')
const throttle = require('db-hafas/throttle')
const createEstimate = require('hafas-estimate-station-weight')
const weights = require('compute-db-station-weight/lib/weights')
const concurrentThrough = require('through2-concurrent')
const progressStream = require('progress-stream')
const pump = require('pump')

const throttledHafas = throttle(10, 1000) // 10 reqs/s
const walk = createWalk(throttledHafas)

const maxIterations = 30
const weight0Msg = `\
has a weight of 0. Probably there are no departures here.`

const estimateStationWeight = createEstimate(throttledHafas, weights)
const computeWeight = (s, _, cb) => {
	estimateStationWeight(s.id + '', maxIterations)
	.then(weight => {
		if (weight === 0) console.error(s.id + '', s.name, weight0Msg)
		else s.weight = weight
		cb(null, s)
	})
	.catch((err) => {
		if (err.isHafasError) {
			console.error(s.id + '', s.name, err.message || (err + ''))
			cb(null)
		} else cb(err)
	})
}

const berlinHbf = '8011160'

const download = () => {
	const data = walk(berlinHbf)
	const weight = concurrentThrough.obj({maxConcurrency: 5}, computeWeight)
	const progess = progressStream({objectMode: true})

	data.on('stats', ({requests, stations, edges, queued}) => {
		progess.setLength(stations + queued)
	})

	return pump(data, weight, progess, (err) => {})
}

module.exports = download
