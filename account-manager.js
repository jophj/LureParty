const fs = require('fs')
const promise = require('bluebird')

async function importAccounts(fileName) {
  const fileContent = fs.readFileSync(fileName)
  const rows = fileContent.toString().split('\r\n')
  const accounts = rows.map(r => r.split(',').splice(1))
  return new Promise((res) => res(accounts.filter(a => a && a.length)))
}

module.exports = {
  importAccounts: importAccounts
}