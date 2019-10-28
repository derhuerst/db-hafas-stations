'use strict'

const test = require('tape')
const isStream = require('is-stream')
const isRoughlyEqual = require('is-roughly-equal')
const validate = require('validate-fptf')()

const stations = require('.')

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
	const stream = stations()
	t.ok(isStream.readable(stream))

	stream
	.on('error', t.ifError)
	.on('data', (s) => {
		assertIsValidStation(t, s)
	})
	.on('end', () => t.end())
})

test('data.ndjson contains Berlin Jungfernheide', (t) => {
	const stream = stations()
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
	const stream = stations.full()
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
	const stream = stations.full()
	t.ok(isStream.readable(stream))

	stream
	.on('error', t.ifError)
	.on('data', (s) => {
		if (s.id === '8011167') {
			assertIsJungfernheide(t, s)
			t.ok(isRoughlyEqual(.0001, s.location.latitude, 52.530408))
			t.ok(isRoughlyEqual(.0001, s.location.longitude, 13.299424))

			stream.destroy()
			t.end()
		}
	})
})
