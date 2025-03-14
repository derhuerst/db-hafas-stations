import withThrottling from 'hafas-client/throttle.js'
import withRetrying from 'hafas-client/retry.js'
import createHafas from 'hafas-client'
import dbProfile from 'hafas-client/p/db/index.js'

const userAgent = 'db-hafas-stations build'
const throttled = withThrottling(dbProfile, 3, 1000) // 3 reqs/s)
const retryingThrottled = withRetrying(throttled, {
	retries: 2,
})
const hafas = createHafas(retryingThrottled, userAgent)

export {
	hafas,
}
