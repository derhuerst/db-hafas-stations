# db-hafas-stations

**All [*Deutsche Bahn* (DB)](https://en.wikipedia.org/wiki/Deutsche_Bahn) stations** returned by [their HAFAS API](https://github.com/public-transport/hafas-client/tree/2ec079adfc8a3d988190491b7e07dc03826b719e/p/db), currently about 299k.

[![npm version](https://img.shields.io/npm/v/db-hafas-stations.svg)](https://www.npmjs.com/package/db-hafas-stations)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/db-hafas-stations.svg)
![minimum Node.js version](https://img.shields.io/node/v/db-hafas-stations.svg)
[![support me via GitHub Sponsors](https://img.shields.io/badge/support%20me-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)
[![chat with me on Twitter](https://img.shields.io/badge/chat%20with%20me-on%20Twitter-1da1f2.svg)](https://twitter.com/derhuerst)


## Installation

```shell
npm install db-hafas-stations
```

*Note:* This Git repo does not contain the data, but the npm package does.


## Usage

`readSimplifiedStations()` is an [async generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*) yielding [*Friendly Public Transport Format*](https://github.com/public-transport/friendly-public-transport-format) `station` and `stop` objects, read from `db-hafas-stations/data.ndjson` (~14mb).

```js
import {
	readSimplifiedStations,
	readFullStations,
} from 'db-hafas-stations'

for await const (station of readSimplifiedStations()) {
	console.log(station)
}
```

```js
{
	type: 'station',
	id: '8000007',
	name: 'Alzey',
	weight: 73.1,
	location: {
		type: 'location',
		latitude: 49.7502,
		longitude: 8.109749
	}
}
// …
```

`readFullStations()` is an async generator function yielding objects with more fields, read from `db-hafas-stations/full.ndjson` (~112mb).


## Related

- [`db-hafas-stations-autocomplete`](https://github.com/derhuerst/db-hafas-stations-autocomplete#db-stations-autocomplete) – Search for stations of DB (data from HAFAS).
- [`db-stations`](https://github.com/derhuerst/db-stations#db-stations) – A collection of all stations of Deutsche Bahn, computed from open data.
- [`hafas-find-stations`](https://github.com/derhuerst/hafas-find-stations) – Given a HAFAS client, find all stations in a bounding box.
- [`hafas-discover-stations`](https://github.com/derhuerst/hafas-discover-stations#hafas-discover-stations) – Pass in a HAFAS client, discover stations by querying departures.
- [`db-stops-search`](https://github.com/derhuerst/db-stops-search) – Search through all stops/stations in `db-hafas-stations`. Formats and imports the stops into a Meilisearch instance.


## Contributing

If you have a question or have difficulties using `db-hafas-stations`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/derhuerst/db-hafas-stations/issues).
