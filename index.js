import {join as pathJoin} from 'node:path'
import fs from 'node:fs'
import ndjson from 'ndjson'
import through from 'through2'

const srcSparse = pathJoin(import.meta.dirname, 'data.ndjson')
const srcFull = pathJoin(import.meta.dirname, 'full.ndjson')

const unpackSparse = (s, _, cb) => {
	cb(null, {
		type: 'station',
		id: s[0],
		name: s[1],
		weight: s[2]
	})
}

const readSimplifiedStations = () => {
	return fs.createReadStream(srcSparse)
	.pipe(ndjson.parse())
	.pipe(through.obj(unpackSparse))
}

const readFullStations = () => {
	return fs.createReadStream(srcFull)
	.pipe(ndjson.parse())
}

export {
	readSimplifiedStations,
	readFullStations,
}
