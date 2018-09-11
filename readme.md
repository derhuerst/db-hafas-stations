# db-hafas-stations

**A list of DB stations, taken from HAFAS.**

*Warning*: This module does not contain stations without an [IBNR](https://de.wikipedia.org/wiki/Internationale_Bahnhofsnummer).

[![npm version](https://img.shields.io/npm/v/db-hafas-stations.svg)](https://www.npmjs.com/package/db-hafas-stations)
[![build status](https://app.codeship.com/projects/28b60ee0-55de-0136-071a-561f2b18c79f/status?branch=master)](https://app.codeship.com/projects/294654)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/db-hafas-stations.svg)
[![chat with me on Gitter](https://img.shields.io/badge/chat%20with%20me-on%20gitter-512e92.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installation

```shell
npm install db-hafas-stations
```


## Usage

`stations()` returns a [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) in [object mode](https://nodejs.org/api/stream.html#stream_object_mode), emitting [*Friendly Public Transport Format*](https://github.com/public-transport/friendly-public-transport-format) `station` objects.

```js
const stations = require('db-hafas-stations')

stations()
.on('data', console.log)
.on('error', console.error)
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


## Contributing

If you have a question or have difficulties using `db-hafas-stations`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/derhuerst/db-hafas-stations/issues).
