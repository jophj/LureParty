const geolib = require('geolib')

function getWaitTime(from, to, speedMs) {
  if (!from || ! to) return 0
  const distance = geolib.getDistance (
    { latitude: from[0], longitude: from[1] },
    { latitude: from[0], longitude: to[1] }
  )
  return distance / speedMs
}

function nearbyReducerGenerator(latitude, longitude) {
  return (n, f) => {
    let distance = geolib.getDistance (
      { latitude: latitude, longitude: longitude },
      { latitude: f.latitude, longitude: f.longitude }
    )

    if (!n || !n.distance) return {
      distance: distance,
      item: f
    }

    if (distance < (n.distance || Infinity)) {
      n.item = f
      n.distance = distance
    }

    return n
  }
}

module.exports = {
  getWaitTime: getWaitTime,
  nearbyReducerGenerator: nearbyReducerGenerator
}