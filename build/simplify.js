import through from 'through2'

const simplifyStation = () => {
	return through.obj((data, _, cb) => {
		cb(null, [
			data.id,
			data.name,
			data.weight
			// todo: more?
		])
	})
}

export {
	simplifyStation,
}
