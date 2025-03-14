import createEstimate from 'hafas-estimate-station-weight'
import weights from 'compute-db-station-weight/lib/weights.js'
import omit from 'lodash/omit.js'
import concurrentThrough from 'through2-concurrent'
import {pipeline} from 'node:stream/promises'
import {Transform} from 'node:stream'
import {parse, stringify} from 'ndjson'
import {hafas} from './hafas.js'

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

await pipeline(
	process.stdin,
	parse(),
	concurrentThrough.obj({maxConcurrency: 5}, computeWeight),
	new Transform({
		objectMode: true,
		transform: fixStopsWithoutStation,
	}),
	stringify(),
	process.stdout,
)
