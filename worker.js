const geolib = require('geolib')
const pogobuf = require('pogobuf-vnext')
const POGOProtos = require('node-pogo-protos')
const config = require('./config.json')

function getWaitTime(from, to, speedMs) {
  if (!from || ! to) return 0
  const distance = geolib.getDistance (
    { latitude: from[0], longitude: from[1] },
    { latitude: from[0], longitude: to[1] }
  )
  console.log(distance)
  return distance / speedMs
}

async function login(username, password) {
  let client = new pogobuf.Client({
		authType: 'ptc',
		username: username,
		password: password,
		hashingKey: config.hashingKey,
		useHashingServer: true,
	})

	await client.init()
	await client.getPlayer('US', 'en', 'Europe/Paris')
	let response = await client.batchStart()
		.downloadRemoteConfigVersion(POGOProtos.Enums.Platform.IOS, '', '', '', 6301)
		.checkChallenge()
		.batchCall()

    return client
}

async function getLuresCount(client) {
  let response = await client.getInventory()
  let inventory = pogobuf.Utils.splitInventory(response)
  let itemLure = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK === item.item_id)
  return itemLure ? itemLure.count : 0
}

async function checkIfLured(client, pokestop) {
  let response = await client.fortDetails(pokestop.pokestop_id, pokestop.latitude, pokestop.longitude)
  return response.modifiers && response.modifiers.length > 0
}

async function placeLure(client, pokestop) {
  let modifierResponse = true// await client.addFortModifier(POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK, pokestop.pokestop_id)
  return modifierResponse
}

class Worker {
  constructor(account, pokestopQueue, speedMs) {
    this.account = account
    this.pokestopQueue = pokestopQueue
    this.lastPosition = null
    this.speedMs = speedMs
  }

  async moveTo(client, latitude, longitude) {
    const waitTimeSeconds = getWaitTime([latitude, longitude], this.lastPosition, this.speedMs)

    return new Promise((res) => {
      console.log(`${this.account[0]} Waiting ${waitTimeSeconds}s to move`)
      setTimeout(async () => {
        await client.setPosition(latitude, longitude)
        this.lastPosition = [ latitude, longitude ]
        res()
      }, waitTimeSeconds * 1000)
    })
  }

  async init() {
    this.isActive = true    
    this.client = await login(this.account[0], this.account[1])
    this.lures = await getLuresCount(this.client)
    console.log(`${this.account[0]} Logged in with ${this.lures} lures`)
  }

  async start() {
    const that = this
    while (this.lures > 0) {
      const pokestop = this.pokestopQueue.pop()
      if (!pokestop) {
        console.log(`${this.account[0]} All pokestops already taken. Quitting`)
        break
      }
      
      let lured = await checkIfLured(this.client, pokestop)
      if (lured) {
        console.log(`${this.account[0]} Pokestop already lured. Skipping`)
        continue;
      }

      await that.moveTo(this.client, pokestop.latitude, pokestop.longitude)
      console.log(`${this.account[0]} Placing lure at ${pokestop.pokestop_id}`)      
      let placeLureResponse = await placeLure(this.client, pokestop)
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