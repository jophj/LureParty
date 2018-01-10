const inside = require('point-in-polygon')
const allPokestops = require('../pokestops.json')
const accountManager = require('../utils/account-manager')
const proxyManager = require('../utils/proxy-manager')
const Worker = require('./worker')
const pogobuf = require('pogobuf-vnext')
const Promise = require('bluebird')
const fs = require('fs')

const PTCLogin = pogobuf.PTCLogin

const config = require('../config.json')
const geoFence = require('../geofences.json')[config.geoFence || 'default']

async function Main(params) {
  const accounts = await accountManager.importAccounts('accounts.csv')

  const logPromises = accounts.map(a => {
    return new Promise(async function(resolve, reject) {
      const login = new PTCLogin();
      login.setProxy(proxyManager.getProxy());
      
      try {
        const token = await login.login(a[0], a[1])
        if (token) resolve(a)
        else resolve(false)
      }
      catch(e) {
        resolve(false)
      }
    })
  })

  const tokens = await Promise.all(logPromises)
  const loggableAccounts = tokens.filter(t => t)
  
  console.log(loggableAccounts)
  const csv = loggableAccounts.map(a => `ptc,${a[0]},${a[1]}`).join('\n')
  fs.writeFile('loggable.csv', csv)

  return
  const pokestops = allPokestops.filter(p => inside([p.latitude, p.longitude], geoFence))
  const pokestopQueue = new Queue(pokestops)

  const proxy = proxyManager.getProxy()
  const workers = accounts.map((a, i) =>
    new Worker(a, pokestopQueue, config.speedMs, config.hashingKey[i % config.hashingKey.length], proxy)
  )
  
  await Promise.all(workers.map( async (w) => await w.init()))
  await Promise.all(workers.map( async (w) => await w.start()))

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