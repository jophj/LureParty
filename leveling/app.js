const Worker = require('./worker')
const config = require('../config.json')

async function Main() {
  const worker = new Worker(['rocketMapPO2040','R0cketMap!'], config.speedMs, config.hashingKey)
  await worker.init()
  worker.start(43.881763, 11.097824)
}

Main()