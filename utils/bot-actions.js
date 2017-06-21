const pogobuf = require('pogobuf-vnext')
const POGOProtos = require('node-pogo-protos')
const utils = require('./utils')

async function login(username, password, hashingKey) {
  let client = new pogobuf.Client({
		authType: 'ptc',
		username: username,
		password: password,
		hashingKey: hashingKey,
		useHashingServer: true,
	})

	await client.init()
	let player = await client.getPlayer('US', 'en', 'Europe/Paris')
	let response = await client.batchStart()
		.downloadRemoteConfigVersion(POGOProtos.Enums.Platform.IOS, '', '', '', 6301)
		.checkChallenge()
		.batchCall()

  return client
}

async function getLuresCount(client) {
  let inventory = await getInventory(client)
  let itemLure = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK === item.item_id)
  return itemLure ? itemLure.count : 0
}

async function getBallsCount(client) {
  let inventory = await getInventory(client)
  let itemPokeBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_POKE_BALL === item.item_id)
  let itemGreatBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_GREAT_BALL === item.item_id)
  let itemUltraBall = inventory.items.find(item => POGOProtos.Inventory.Item.ItemId.ITEM_ULTRA_BALL === item.item_id)
  return [
    itemPokeBall ? itemPokeBall.count : 0,
    itemGreatBall ? itemGreatBall.count : 0,
    itemUltraBall ? itemUltraBall.count : 0
  ]
}

async function getInventory(client) {
  let response = await client.getInventory()
  let inventory = pogobuf.Utils.splitInventory(response)
  return inventory
}

async function checkIfLured(client, pokestop) {
  let response = await client.fortDetails(pokestop.pokestop_id, pokestop.latitude, pokestop.longitude)
  return response.modifiers && response.modifiers.length > 0
}

async function placeLure(client, pokestop) {
  let modifierResponse = true // await client.addFortModifier(POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK, pokestop.pokestop_id)
  return modifierResponse
}

async function startTutorial(client, tutorialState) {
  if (!tutorialState) tutorialState = []

  if (tutorialState.indexOf(POGOProtos.Enums.TutorialState.LEGAL_SCREEN) < 0) {
    await client.markTutorialComplete(POGOProtos.Enums.TutorialState.LEGAL_SCREEN)
  }

  if (tutorialState.indexOf(POGOProtos.Enums.TutorialState.AVATAR_SELECTION) < 0) {
    await client.setAvatar({
      'hair': Math.floor(Math.random() * (5 - 1 + 1) + 1),
      'shirt': Math.floor(Math.random() * (3 - 1 + 1) + 1),
      'pants': Math.floor(Math.random() * (2 - 1 + 1) + 1),
      'shoes': Math.floor(Math.random() * (6 - 1 + 1) + 1),
      'avatar': Math.floor(Math.random() * (1 - 0 + 1) + 0),
      'eyes': Math.floor(Math.random() * (4 - 1 + 1) + 1),
      'backpack': Math.floor(Math.random() * (5 - 1 + 1) + 1)
    })
    await client.markTutorialComplete(POGOProtos.Enums.TutorialState.AVATAR_SELECTION)
  }

  if (tutorialState.indexOf(POGOProtos.Enums.TutorialState.POKEMON_CAPTURE) < 0) {
    await client.getDownloadURLs([
      '1a3c2816-65fa-4b97-90eb-0b301c064b7a/1477084786906000',
      'aa8f7687-a022-4773-b900-3a8c170e9aea/1477084794890000',
      'e89109b0-9a54-40fe-8431-12f7826c8194/1477084802881000'
    ])

    await client.encounterTutorialComplete([1, 4, 7][Math.floor(Math.random() * 3)])
  }

  if (tutorialState.indexOf(POGOProtos.Enums.TutorialState.NAME_SELECTION) < 0) {
    codeName = 'LurePO' +
      new Array(8)
        .fill(0)
        .reduce((c, d) => c+String.fromCharCode(Math.floor(Math.random() * (122 - 97 + 1) + 97)), '')
    let response = await client.claimCodename(codeName)
    await client.markTutorialComplete(POGOProtos.Enums.TutorialState.NAME_SELECTION)
  }

  if (tutorialState.indexOf(POGOProtos.Enums.TutorialState.FIRST_TIME_EXPERIENCE_COMPLETE) < 0) {
    await client.markTutorialComplete(POGOProtos.Enums.TutorialState.FIRST_TIME_EXPERIENCE_COMPLETE)
  }
}

async function moveTo(client, latitude, longitude, speedMs) {
  let waitTimeSeconds = 0
  if (client.playerLatitude && client.playerLongitude) {
    waitTimeSeconds = utils.getWaitTime(
      [latitude, longitude],
      [client.playerLatitude, client.playerLongitude],
      speedMs
    )
  }

  return new Promise((res) => {
    setTimeout(async () => {
      await client.setPosition(latitude, longitude)
      res()
    }, waitTimeSeconds * 1000)
  })
}

async function catchPokemon(client, catchablePokemon, ballsCount) {
  await client.encounter(catchablePokemon.encounter_id, catchablePokemon.spawn_point_id)
  let pokeballItemID = [
    POGOProtos.Inventory.Item.ItemId.ITEM_POKE_BALL,
    POGOProtos.Inventory.Item.ItemId.ITEM_GREAT_BALL,
    POGOProtos.Inventory.Item.ItemId.ITEM_ULTRA_BALL
  ][ballsCount.findIndex(c => c > 0)]
  let catchPokemonResponse = await client.catchPokemon(
    catchablePokemon.encounter_id,
    pokeballItemID,
    1.70 + 0.25 * Math.random(),
    catchablePokemon.spawn_point_id,
    true,
    1,
    1
  )
  return catchPokemonResponse
}

module.exports = {
  login: login,
  getInventory: getInventory,
  getLuresCount: getLuresCount,
  getBallsCount: getBallsCount,
  startTutorial: startTutorial,
  catchPokemon: catchPokemon,
  moveTo: moveTo,
  checkIfLured: checkIfLured,
  placeLure: placeLure
}