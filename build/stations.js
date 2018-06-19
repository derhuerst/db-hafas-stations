'use strict'

const walk = require('discover-db-stations')
const concurrentThrough = require('through2-concurrent')
const progressStream = require('progress-stream')
const pump = require('pump')

const estimateStationWeight = require('./estimate-station-weight')

const maxIterations = 30
const weight0Msg = `\
has a weight of 0. Probably there are no departures here.`

const berlinHbf = '8011160'

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
			cb()
		} else cb(err)
	})
}

const download = () => {
	const data = walk(berlinHbf)
	const weight = concurrentThrough.obj({maxConcurrency: 5}, computeWeight)
	weight.on('data', (s) => console.log(s.id, s.weight))
	const progess = progressStream({objectMode: true})

	data.on('stats', ({requests, stations, edges, queued}) => {
		progess.setLength(stations + queued)
	})

	return pump(data, weight, progess)
}

module.exports = download
