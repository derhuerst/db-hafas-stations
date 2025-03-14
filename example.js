import {readSimplifiedStations} from './index.js'

readSimplifiedStations()
.on('data', console.log)
.on('error', (err) => {
	console.error(err)
	process.exit(1)
})
