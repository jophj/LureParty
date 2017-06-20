const accountManager = require('../lureParty/account-manager')
const Worker = require('./worker')
const config = require('../config.json')

async function Main() {
  let accounts = await accountManager.importAccounts('./accounts.csv')
  const workers = accounts.map(a => new Worker(a, config.speedMs, config.hashingKey))
  workers.forEach(async w => {
    await w.init()
    w.start(43.881763, 11.097824, 45000)
  })
}

Main()