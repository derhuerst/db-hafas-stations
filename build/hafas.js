'use strict'

const withThrottling = require('hafas-client/throttle')
const withRetrying = require('hafas-client/retry')
const createHafas = require('hafas-client')
const dbProfile = require('hafas-client/p/db')

const userAgent = 'db-hafas-stations build'
const throttled = withThrottling(dbProfile, 3, 1000) // 3 reqs/s)
const retryingThrottled = withRetrying(throttled, {
	retries: 2,
})
const hafas = createHafas(retryingThrottled, userAgent)

module.exports = hafas
