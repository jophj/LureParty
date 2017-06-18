const Worker = require('./worker')
const config = require('../config.json')

// ptc,rocketMapPO1161,R0cketMap!
async function Main() {
  const worker = new Worker(['rocketMapPO2013','R0cketMap!'], config.speedMs, config.hashingKey)
  await worker.init()
  worker.start(43.881763, 11.097824, 45000)
}

Main()