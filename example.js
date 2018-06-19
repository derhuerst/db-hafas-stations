'use strict'

const readStations = require('.')

readStations()
.on('data', console.log)
.on('error', (err) => {
	console.error(err)
	process.exit(1)
})
