'use strict'

const createEstimate = require('hafas-estimate-station-weight')
const weights = require('compute-db-station-weight/lib/weights')
const omit = require('lodash/omit')
const concurrentThrough = require('through2-concurrent')
const {pipeline, Transform} = require('stream')
const {parse, stringify} = require('ndjson')
const hafas = require('./hafas')

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

const abortWithError = (err) => {
	if (!err) return;
	console.error(err)
	process.exit(1)
}

return pipeline(
	process.stdin,
	parse(),
	concurrentThrough.obj({maxConcurrency: 5}, computeWeight),
	new Transform({
		objectMode: true,
		transform: fixStopsWithoutStation,
	}),
	stringify(),
	process.stdout,
	abortWithError,
)
