import {join as pathJoin} from 'node:path'
import fs from 'node:fs'
import ndjson from 'ndjson'
import through from 'through2'

const srcSparse = pathJoin(import.meta.dirname, 'data.ndjson')
const srcFull = pathJoin(import.meta.dirname, 'full.ndjson')

const unpackSparse = (s) => {
	return {
		type: 'station',
		id: s[0],
		name: s[1],
		weight: s[2]
	}
}

async function* readSimplifiedStations () {
	const stations = fs.createReadStream(srcSparse)
	.pipe(ndjson.parse())

	for await (const station of stations) {
		yield unpackSparse(station)
	}
}

async function* readFullStations () {
	const stations = fs.createReadStream(srcFull)
	.pipe(ndjson.parse())

	for await (const station of stations) {
		yield station
	}
}

export {
	readSimplifiedStations,
	readFullStations,
}
