const geolib = require('geolib')

function getWaitTime(from, to, speedMs) {
  if (!from || ! to) return 0
  const distance = geolib.getDistance (
    { latitude: from[0], longitude: from[1] },
    { latitude: from[0], longitude: to[1] }
  )
  console.log(distance)
  return distance / speedMs
}

module.exports = {
  getWaitTime: getWaitTime,
}