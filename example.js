import {readSimplifiedStations} from './index.js'

for await (const station of readSimplifiedStations()) {
	console.log(station)
}
