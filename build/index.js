'use strict'

const {pipeline: pump} = require('stream')
const ndjson = require('ndjson')
const fs = require('fs')
const path = require('path')

const simplify = require('./simplify')

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
	fs.createWriteStream(path.join(__dirname, '../data.ndjson')),
	showError
)

pump(
	stations,
	ndjson.stringify(),
	fs.createWriteStream(path.join(__dirname, '../full.ndjson')),
	showError
)
