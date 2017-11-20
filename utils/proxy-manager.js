const proxies = require('../config.json').proxies

function getProxy() {
  return proxies[Math.floor(Math.random() * proxies.length)]
}

module.exports = {
  getProxy: getProxy
}
