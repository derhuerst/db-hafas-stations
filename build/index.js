import {pipeline as pump} from 'node:stream'
import ndjson from 'ndjson'
import fs from 'node:fs'
import {join as pathJoin, dirname} from 'node:path'
import {fileURLToPath} from 'node:url';
import {simplifyStation as simplify} from './simplify.js'

const __dirname = dirname(fileURLToPath(import.meta.url));

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
		pathJoin(__dirname, '../data.ndjson'),
	),
	showError
)

pump(
	stations,
	ndjson.stringify(),
	fs.createWriteStream(
		pathJoin(__dirname, '../full.ndjson'),
	),
	showError
)
