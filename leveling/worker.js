const geolib = require('geolib')
const pogobuf = require('pogobuf-vnext')
const POGOProtos = require('node-pogo-protos-vnext')
const botActions = require('../utils/bot-actions')
const utils = require('../utils/utils')
const Promise = require('bluebird')
const StateMachine = require('../lureParty/state-machine')

function updateFortList(oldForts, newData) {
  const fortsToAdd = newData.filter(f => !oldForts.find(of => of.id === f.id))
  Array.prototype.push.apply(oldForts, fortsToAdd)
}

async function getBotData(client) {
    let inventory = await botActions.getInventory(client)
    let itemPokeBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_POKE_BALL === item.item_id)
    let itemGreatBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_GREAT_BALL === item.item_id)
    let itemUltraBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_ULTRA_BALL === item.item_id)

    const cellIDs = pogobuf.Utils.getCellIDs(client.playerLatitude, client.playerLongitude, 5, 17)
    let mapObjects = await client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0))

    let forts = mapObjects.map_cells
      .map(current => current.forts)
    forts = forts.reduce((a, c) => a.concat(c), []).filter(f => f.type === 1)

    let catchablePokemons = mapObjects.map_cells
      .map(current => current.catchable_pokemons)
    catchablePokemons = catchablePokemons.reduce((a, c) => a.concat(c), [])

    let wildPokemons = mapObjects.map_cells
      .map(current => current.wild_pokemons)
    wildPokemons = wildPokemons.reduce((a, c) => a.concat(c), [])

    return {
      pokeBallCount: itemPokeBall ? itemPokeBall.count : 0,
      greatBallCount: itemGreatBall ? itemGreatBall.count : 0,
      ultraBallCount: itemUltraBall ? itemUltraBall.count : 0,
      forts,
      catchablePokemons,
      wildPokemons,
      experience: inventory.player.experience
    }
}

async function startFarmingUntil(client, expToGain, speedMs) {
  if (!client.playerLatitude || !client.playerLongitude) {
    return -1
  }

  let botData = await getBotData(client)
  let wildPokemonList = botData.wildPokemons
  const fortList = botData.forts
  let ballCount = [ botData.pokeBallCount, botData.greatBallCount, botData.ultraBallCount ].reduce(reduceSum)

  const transitions = [
    { from: 'start', to: 'end', condition: () => botData.experience >= expToGain },
    { from: 'start', to: 'catch', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length > 0 },
    { from: 'start', to: 'farm', condition: () => botData.experience < expToGain && ballCount < 12 },
    { from: 'start', to: 'farm', condition: () => botData.experience < expToGain && botData.catchablePokemons.length === 0 && wildPokemonList.length === 0 },
    { from: 'start', to: 'hunt', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length === 0 && wildPokemonList.length > 0  },
    { from: 'catch', to: 'end', condition: () => botData.experience >= expToGain },
    { from: 'catch', to: 'catch', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length > 0 },
    { from: 'catch', to: 'farm', condition: () => botData.experience < expToGain && ballCount < 12 },
    { from: 'catch', to: 'farm', condition: () => botData.experience < expToGain && botData.catchablePokemons.length === 0 && wildPokemonList.length === 0 },
    { from: 'catch', to: 'hunt', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length === 0 && wildPokemonList.length > 0 },
    { from: 'farm', to: 'end', condition: () => botData.experience >= expToGain },
    { from: 'farm', to: 'farm', condition: () => botData.experience < expToGain && ballCount < 12 },
    { from: 'farm', to: 'farm', condition: () => botData.experience < expToGain && botData.catchablePokemons.length === 0 && wildPokemonList.length === 0 },
    { from: 'farm', to: 'catch', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length > 0 },
    { from: 'farm', to: 'hunt', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length === 0 && wildPokemonList.length > 0 },
    { from: 'hunt', to: 'end', condition: () => botData.experience >= expToGain },
    { from: 'hunt', to: 'hunt', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length === 0 && wildPokemonList.length > 0 },
    { from: 'hunt', to: 'catch', condition: () => botData.experience < expToGain && ballCount >= 12 && botData.catchablePokemons.length > 0 },
    { from: 'hunt', to: 'farm', condition: () => botData.experience < expToGain && ballCount < 12 },
    { from: 'hunt', to: 'farm', condition: () => botData.experience < expToGain && botData.catchablePokemons.length === 0 && wildPokemonList.length === 0 },
  ]
  const stateMachine = new StateMachine(transitions, 'start')
  stateMachine.transition()

  while (stateMachine.currentState !== 'end') {

    console.log(`${client.options.username} State: ${stateMachine.currentState}`)
    await Promise.delay(Math.random() * 500 + 200)
    

    if (botData.wildPokemons.length + botData.forts.length === 0) {
      console.log('ERROR: received no items from scan. Try to lower request rate')
      await Promise.delay(Math.random() * 500 + 5500)
    }

    try {

      if (stateMachine.currentState === 'catch') {
        console.log(`${client.options.username} catching pokemon`)
        let catchablePokemon = botData.catchablePokemons.pop()
        let captureResponse = await botActions.catchPokemon(client, catchablePokemon, [ botData.pokeBallCount, botData.greatBallCount, botData.ultraBallCount ])
        const expGained = captureResponse.capture_award.xp.reduce(reduceSum, 0)
        console.log(`${client.options.username} Pokemon catched. Exp gained: ${expGained}. Total exp: ${botData.experience + expGained}`)
        await Promise.delay(Math.random() * 500 + 2500)

        let inventory = await botActions.getInventory(client)
        let itemPokeBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_POKE_BALL === item.item_id)
        let itemGreatBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_GREAT_BALL === item.item_id)
        let itemUltraBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_ULTRA_BALL === item.item_id)
        botData.pokeBallCount = itemPokeBall ? itemPokeBall.count : 0
        botData.greatBallCount = itemGreatBall ? itemGreatBall.count : 0
        botData.ultraBallCount = itemUltraBall ? itemUltraBall.count : 0
        botData.experience = inventory.player.experience
      }

      if (stateMachine.currentState === 'farm') {
        if (fortList.length === 0) {
          console.log(`${client.options.username} ERROR: no nearby pokestop. Can\'t farm`)
        }

        let nearbyFort = fortList
          .filter(f => f.cooldown_complete_timestamp_ms === 0 || !f.spinned)
          .reduce(
            utils.nearbyReducerGenerator(client.playerLatitude, client.playerLongitude),
            {})
        nearbyFort = nearbyFort.item
        await botActions.moveTo(client, nearbyFort.latitude, nearbyFort.longitude, speedMs)
        await Promise.delay(Math.random() * 500 + 2500)      
        const response = await client.fortSearch(nearbyFort.id, nearbyFort.latitude, nearbyFort.longitude)
        if (response.result === 1) {
          nearbyFort.spinned = true
          console.log(`${client.options.username} Spinned pokestop: ${nearbyFort.id}`)
        }
        else {
          console.log(`${client.options.username} Not spinned: ${nearbyFort.id}. Response result: ${response.result}`)
        }
        await Promise.delay(Math.random() * 500 + 2500)

        botData = await getBotData(client)
        updateFortList(fortList, botData.forts)
        await Promise.delay(Math.random() * 500 + 1500)
      }

      if (stateMachine.currentState === 'hunt') {
        console.log(`${client.options.username} No catchable pokemon. Hunting nearby`)
        const nearbyPokemon = wildPokemonList.reduce(
          utils.nearbyReducerGenerator(client.playerLatitude, client.playerLongitude),
          {})
        const i = wildPokemonList.indexOf(nearbyPokemon)
        wildPokemonList.splice(i, 1)
        await botActions.moveTo(client, nearbyPokemon.item.latitude, nearbyPokemon.item.longitude, speedMs)
        await Promise.delay(Math.random() * 500 + 5500)
        botData = await getBotData(client)
        wildPokemonList = botData.wildPokemons 
      }

      stateMachine.transition()
    }
    catch(e) {
      continue
    }
  }
  console.log(`${client.options.username} Farming done`)
}

function reduceSum(accumulator, value) {
  return accumulator + value
}

class Worker {
  constructor(account, speedMs, hashingKey, proxy) {
    this.account = account
    this.lastPosition = null
    this.speedMs = speedMs
    this.hashingKey = hashingKey
    this.proxy = proxy
  }

  async init(latitude, longitude) {
    this.isActive = true
    try {
      console.log(`${this.account[0]} Trying login`)
      this.client = await botActions.initClient(this.account[0], this.account[1], this.hashingKey, this.proxy)
    }
    catch (e) {
      this.client = null
      console.log(e)
    }
    if (!this.client) {
      console.log(`${this.account[0]} Bad login. Exiting`)
      this.isActive = false
      return
    }

    this.exp = 0
    await Promise.delay(Math.random() * 500 + 2500)
    console.log(`${this.account[0]} Logged in`)
  }

  async start(latitude, longitude, expToGain) {
    if (!this.client) {
      console.log(`${this.account[0]} Not initialized (failed login?). Exiting`)
      this.isActive = false
      return
    }
    const that = this

    let player = await this.client.getPlayer('US', 'en', 'Europe/Paris')
    if (player.player_data.tutorial_state.length < 6) {
      console.log(`${this.account[0]} Starting tutorial`)
      await botActions.startTutorial(this.client, player.player_data.tutorial_state)
      console.log(`${this.account[0]} Tutorial finished`)
    }
    await this.client.setPosition(latitude, longitude)

    await startFarmingUntil(this.client, expToGain, this.speedMs)
    this.isActive = false
    const inventory = await botActions.getInventory(this.client)
    let levelUpResponse = await this.client.levelUpRewards(inventory.player.level)
    await Promise.delay(Math.random() * 500 + 5500)
    await this.client.cleanUp()
    console.log(`${this.account[0]} Ends with ${inventory.player.experience} experience`)
  }
}

module.exports = Worker