import {pipeline as pump} from 'node:stream'
import ndjson from 'ndjson'
import fs from 'node:fs'
import {join as pathJoin} from 'node:path'
import {simplifyStation as simplify} from './simplify.js'

const showError = (err) => {
	if (!err) return
	console.error(err)
	process.exit(1)
}

const stations = ndjson.parse()
process.stdin.pipe(stations)

pump(
	stations,
	simplify(),
	ndjson.stringify(),
	fs.createWriteStream(
		pathJoin(import.meta.dirname, '../data.ndjson'),
	),
	showError
)

pump(
	stations,
	ndjson.stringify(),
	fs.createWriteStream(
		pathJoin(import.meta.dirname, '../full.ndjson'),
	),
	showError
)
