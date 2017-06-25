const geolib = require('geolib')
const POGOProtos = require('node-pogo-protos-vnext')
const botActions = require('../utils/bot-actions')

function getWaitTime(from, to, speedMs) {
  if (!from || ! to) return 0
  const distance = geolib.getDistance (
    { latitude: from[0], longitude: from[1] },
    { latitude: from[0], longitude: to[1] }
  )
  return distance / speedMs
}

class Worker {
  constructor(account, pokestopQueue, speedMs, hashingKey, proxy) {
    this.account = account
    this.pokestopQueue = pokestopQueue
    this.lastPosition = null
    this.speedMs = speedMs
    this.hashingKey = hashingKey
    this.proxy = proxy
  }

  async init() {
    this.isActive = true
    try {
      console.log(`${this.account[0]} Trying login`)
      this.client = await botActions.initClient(this.account[0], this.account[1], this.hashingKey, this.proxy)
    }
    catch (e) {
      console.log(e)
    }
    if (!this.client) {
      console.log(`${this.account[0]} Bad login. Exiting`)
      this.isActive = false
      return
    }

    this.lures = await botActions.getLuresCount(this.client)
    console.log(`${this.account[0]} Logged in with ${this.lures} lures`)
  }

  async start() {
    if (!this.client) {
      console.log(`${this.account[0]} Not initialized (failed login?). Exiting`)
      this.isActive = false
      return
    }

    while (this.lures > 0) {
      const pokestop = this.pokestopQueue.pop()
      if (!pokestop) {
        console.log(`${this.account[0]} All pokestops already taken. Quitting`)
        break
      }
      
      let lured = await botActions.checkIfLured(this.client, pokestop)
      if (lured) {
        console.log(`${this.account[0]} Pokestop already lured. Skipping`)
        continue;
      }

      await botActions.moveTo(this.client, pokestop.latitude, pokestop.longitude, this.speedMs)
      console.log(`${this.account[0]} Placing lure at ${pokestop.pokestop_id}`)      
      let placeLureResponse = await botActions.placeLure(this.client, pokestop)
      if (placeLureResponse) {
        console.log(`${this.account[0]} Lure placed at ${pokestop.pokestop_id}`)
      }
      else {
        console.log(`${this.account[0]} Error. Lure not placed at ${pokestop.pokestop_id}. Skipping pokestop`)              
      }
      this.lures -= 1
    }
    this.isActive = false
    await this.client.cleanUp()
    console.log(`${this.account[0]} Ends with ${this.lures} lures remaining`)
  }
}

module.exports = Worker