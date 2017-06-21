const inside = require('point-in-polygon')
const allPokestops = require('../pokestops.json')
const accountManager = require('../utils/account-manager')
const proxyManager = require('../utils/proxy-manager')
const Worker = require('./worker')

const config = require('../config.json')
const geoFence = require('../geofences.json')[config.geoFence || 'default']

async function Main(params) {
  let accounts = await accountManager.importAccounts('accounts.csv')

  const pokestops = allPokestops.filter(p => inside([p.latitude, p.longitude], geoFence))
  const pokestopQueue = new Queue(pokestops)

  const proxy = proxyManager.getProxy()
  const workers = accounts.map(a => new Worker(a, pokestopQueue, config.speedMs, config.hashingKey, proxy))
  workers.forEach(async w => {
    await w.init()
    w.start()
  })

  const checkStatusInterval = setInterval(() => {
    if (workers.every(w => !w.isActive)) {
      console.log(`Done. Pokestops not lured ${pokestopQueue.size()}`)
      clearInterval(checkStatusInterval)
    }
  }, 1000)
}


class Queue {
  constructor(items) {
    this.items = items
  }

  pop() {
    return this.items.pop()
  }
  isEmpty() {
    return this.items.length === 0
  }
  size() {
    return this.items.length
  }
}

Main()
	.then(() => console.log())
	.catch(e => console.error(e))