'use strict'

const path = require('path')
const fs = require('fs')
const ndjson = require('ndjson')
const through = require('through2')

const srcSparse = path.join(__dirname, 'data.ndjson')
const srcFull = path.join(__dirname, 'full.ndjson')

const unpackSparse = (s, _, cb) => {
	cb(null, {
		type: 'station',
		id: s[0],
		name: s[1],
		weight: s[2]
	})
}

const readSparse = () => {
	return fs.createReadStream(srcSparse)
	.pipe(ndjson.parse())
	.pipe(through.obj(unpackSparse))
}

const readFull = () => {
	return fs.createReadStream(srcFull)
	.pipe(ndjson.parse())
}

readSparse.full = readFull
module.exports = readSparse
