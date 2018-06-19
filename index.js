'use strict'

const path = require('path')
const fs = require('fs')
const ndjson = require('ndjson')

const src = path.join(__dirname, 'data.ndjson')

const readStations = () => {
	return fs.createReadStream(src)
	.pipe(ndjson.parse())
}

module.exports = readStations
