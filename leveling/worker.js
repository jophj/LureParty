const geolib = require('geolib')
const pogobuf = require('pogobuf-vnext')
const POGOProtos = require('node-pogo-protos')
const botActions = require('../lureParty/bot-actions')

async function startFarmingUntil(client, totalExp, speedMs) {
  if (!client.playerLatitude || !client.playerLongitude) {
    return -1
  }


  const wildPokemonList = []
  const fortList = []
  while (totalExp > 0) {
  
    let ballsCount = await botActions.getBallsCount(client)
    let luresCount = await botActions.getLuresCount(client)
    
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

    wildPokemons.forEach(wp => {
      if (!wildPokemonList.find(e => e.encounter_id === wp.encounter_id)) {
        wildPokemonList.push(wp)
      }
    })

    forts.forEach(wp => {
      if (!fortList.find(e => e.id === wp.id)) {
        fortList.push(wp)
      }
    })

    if (wildPokemons.length + forts.length === 0) {
      console.log('ERROR: received no items from scan. Try to lower request rate')
    }

    function nearbyReducer(latitude, longitude) {

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

    while (ballsCount.reduce(reduceSum) >= 12 && catchablePokemons.length > 0) {
      let catchablePokemon = catchablePokemons.pop()
      let captureResponse = await botActions.catchPokemon(client, catchablePokemon, ballsCount)
      totalExp -= captureResponse.capture_award.xp.reduce(reduceSum, 0)
    }

    

    if (ballsCount.reduce(reduceSum) >= 12 && wildPokemonList.length > 0) {
      const nearbyPokemon = wildPokemonList.reduce(nearbyReducer(client.playerLatitude, client.playerLongitude), {})
      await botActions.moveTo(client, nearbyPokemon.item.latitude, nearbyPokemon.item.longitude, speedMs)
    }
    else if (ballsCount.reduce(reduceSum) < 12 || catchablePokemons.length === 0) {
      if (fortList.length === 0) {
        console.log('ERROR: no nearby pokestop. Can\'t do anything')
      }
      let nearbyFort = fortList.filter(f => f.cooldown_complete_timestamp_ms === 0).reduce(nearbyReducer(client.playerLatitude, client.playerLongitude), {})
      nearbyFort = nearbyFort.item

      await botActions.moveTo(client, nearbyFort.latitude, nearbyFort.longitude, speedMs)
      await client.fortSearch(nearbyFort.id, nearbyFort.latitude, nearbyFort.longitude)
    }
  }
}

function reduceSum(accumulator, value) {
  return accumulator + value
}

class Worker {
  constructor(account, speedMs, hashingKey) {
    this.account = account
    this.lastPosition = null
    this.speedMs = speedMs
    this.hashingKey = hashingKey
  }

  async init(latitude, longitude) {
    this.isActive = true
    try {
      console.log(`${this.account[0]} Trying login`)
      this.client = await botActions.login(this.account[0], this.account[1], this.hashingKey)
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
    console.log(`${this.account[0]} Logged in`)
  }

  async start(latitude, longitude) {
    if (!this.client) {
      console.log(`${this.account[0]} Not initialized (failed login?). Exiting`)
      this.isActive = false
      return
    }
    const that = this

    let player = await this.client.getPlayer('US', 'en', 'Europe/Paris')
    if (player.player_data.tutorial_state.length < 6) {
      await botActions.startTutorial(this.client, player.player_data.tutorial_state)
    }
    player = await this.client.getPlayer('US', 'en', 'Europe/Paris')

    await this.client.setPosition(latitude, longitude)

    await startFarmingUntil(this.client, 10000, this.speedMs)
    this.isActive = false
    await this.client.cleanUp()
    console.log(`${this.account[0]} Ends with ${this.lures} lures remaining`)
  }
}

module.exports = Worker