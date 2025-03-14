import test from 'tape'
import isStream from 'is-stream'
import isRoughlyEqual from 'is-roughly-equal'
import createFptfValidate from 'validate-fptf'
import {
	readSimplifiedStations,
	readFullStations,
} from './index.js'

const validate = createFptfValidate()

const assertIsValidStation = (t, s) => {
	t.ok(s.type === 'station' || s.type === 'stop')
	t.equal(typeof s.id, 'string')
	t.ok(s.id)
	t.equal(typeof s.name, 'string')
	t.ok(s.name)
	if (s.weight !== null) {
		t.equal(typeof s.weight, 'number')
		t.ok(s.weight > 0)
	}
}

const assertIsJungfernheide = (t, s) => {
	t.equal(s.id, '8011167')
	t.equal(s.name, 'Berlin Jungfernheide')
}

test('data.ndjson contains valid simplified stations', (t) => {
	const stream = readSimplifiedStations()
	t.ok(isStream.readable(stream))

	stream
	.on('error', t.ifError)
	.on('data', (s) => {
		assertIsValidStation(t, s)
	})
	.on('end', () => t.end())
})

test('data.ndjson contains Berlin Jungfernheide', (t) => {
	const stream = readSimplifiedStations()
	t.ok(isStream.readable(stream))

	stream
	.on('error', t.ifError)
	.on('data', (s) => {
		if (s.id === '8011167') {
			assertIsJungfernheide(t, s)

			stream.destroy()
			t.end()
		}
	})
})

test('full.ndjson contains valid full stations', (t) => {
	const stream = readFullStations()
	t.ok(isStream.readable(stream))

	stream
	.on('error', t.ifError)
	.on('data', (s) => {
		assertIsValidStation(t, s)
		try {
			validate(s, ['station', 'stop'])
		} catch (err) {
			t.ifError(err)
		}
	})
	.on('end', () => t.end())
})

test('full.ndjson contains Berlin Jungfernheide', (t) => {
	const stream = readFullStations()
	t.ok(isStream.readable(stream))

	stream
	.on('error', t.ifError)
	.on('data', (s) => {
		if (s.id === '8011167') {
			assertIsJungfernheide(t, s)
			t.ok(isRoughlyEqual(.001, s.location.latitude, 52.530291))
			t.ok(isRoughlyEqual(.001, s.location.longitude, 13.299451))

			stream.destroy()
			t.end()
		}
	})
})
