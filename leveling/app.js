const accountManager = require('../utils/account-manager')
const Worker = require('./worker')
const proxyManager = require('../utils/proxy-manager')
const config = require('../config.json')

async function Main() {
  let accounts = await accountManager.importAccounts('./accounts.csv')
  const proxy = proxyManager.getProxy()
  const workers = accounts.map((a, i) =>
    new Worker(a, config.speedMs, config.hashingKey[i % config.hashingKey.length], proxy)
  )
  
  await Promise.all(workers.map( async (w) => await w.init()))
  await Promise.all(workers.map( async (w) => await w.start(config.location[0], config.location[1], 45000)))
  console.log('Done.')
}

Main()