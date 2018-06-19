'use strict'

const pump = require('pump')
const ndjson = require('ndjson')
const fs = require('fs')
const path = require('path')
const ms = require('ms')

const getStations = require('./stations')
const simplify = require('./simplify')

const showError = (err) => {
	if (!err) return
	console.error(err)
	process.exit(1)
}

const stations = getStations()

const progressInterval = setInterval(() => {
	const p = stations.progress()
	console.info([
		Math.round(p.percentage) + '%',
		'–',
		p.transferred + '/' + p.length,
		'–',
		Math.round(p.speed) + '/s',
		'–',
		'ETA: ' + ms(p.eta * 1000)
	].join(' '))
}, 5 * 1000)

stations.once('end', () => clearInterval(progressInterval))
stations.once('error', () => clearInterval(progressInterval))

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
