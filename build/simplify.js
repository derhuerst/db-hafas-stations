'use strict'

const through = require('through2')

const simplify = () => {
	return through.obj((data, _, cb) => {
		cb(null, [
			data.id,
			data.name,
			data.weight
			// todo: more?
		])
	})
}

module.exports = simplify
