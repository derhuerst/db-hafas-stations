import test from 'tape'
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

test('data.ndjson contains valid simplified stations', async (t) => {
	const stream = readSimplifiedStations()

	for await (const s of stream) {
		assertIsValidStation(t, s)
	}
})

test('data.ndjson contains Berlin Jungfernheide', async (t) => {
	const stream = readSimplifiedStations()

	for await (const s of stream) {
		if (s.id === '8011167') {
			assertIsJungfernheide(t, s)

			return;
		}
	}
	t.fail('station not found')
})

test('full.ndjson contains valid full stations', async (t) => {
	const stream = readFullStations()

	for await (const s of stream) {
		assertIsValidStation(t, s)
		validate(s, ['station', 'stop'])
	}
})

test('full.ndjson contains Berlin Jungfernheide', async (t) => {
	const stream = readFullStations()

	for await (const s of stream) {
		if (s.id === '8011167') {
			assertIsJungfernheide(t, s)
			t.ok(isRoughlyEqual(.001, s.location.latitude, 52.530291))
			t.ok(isRoughlyEqual(.001, s.location.longitude, 13.299451))

			return;
		}
	}
	t.fail('station not found')
})
