import * as net from 'node:net'
import * as readline from 'node:readline'
import * as config from '../config.js'

process.on('uncaughtException', function (error) {
  console.error('Uncaught Error', error)
})

let connections = {}

let blockedAddresses = {}

let listener = new net.Server({
  allowHalfOpen: false,
  noDelay: true
}).on('error', function (error) {
  console.error('listener error', error)
  listener.close()
}).on('close', function () {
  for (let address in connections)
    connections[address].remote.close()
  console.log('listener closed')
}).on('connection', function (remote) {
  const address = remote.remoteAddress
  if (blockedAddresses[address])
    return remote.destroy()
  console.log('new connection from', address)
  let local = new net.Socket({
    allowHalfOpen: false,
  }).on('error', function (error) {
    remote.end()
    local.end()
  }).on('close', function () {
    remote.end()
  }).on('data', function (data) {
    remote.write(data)
  })
  connections[address] = { remote, local }
  remote.on('error', function (error) {
    remote.end()
    local.end()
  }).on('close', function () {
    delete connections[address]
    local.end()
  }).on('data', function (data) {
    if (inspect(data, local))
      return remote.end()
    local.write(data)
  })
  local.connect({
    port: config.game_port,
    host: config.game_host,
    family: 4,
    noDelay: true
  })
}).listen(config.port, config.host, function () {
  console.log('Listener ready on', listener.address().port)
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '%> '
  }).on('close', function () {
    listener.close()
    process.exit(0)
  }).on('line', function (line) {
    let [command, ...params] = line.trim().split(/\s+/)
    command = commands[command.toLowerCase()]
    if (!command)
      console.log('No such command, try "help"')
    else
      command(params, this)
    this.prompt()
  }).prompt()
}).unref()

let commands = {
  'help': function () {
    let result = []
    for (let command in commands)
      result.push(command)
    console.log(result.join('\n'))
  },
  'exit': function (params, con) {
    con.close()
  },
  'connections': function (params, con) {
    let result = []
    for (let address in connections)
      result.push(address)
    console.log(result.join('\n'))
  },
  'block': function (params, con) {
    const address = params.join('')
    if (blockedAddresses[address])
      return console.log('address already blocked')
    blockedAddresses[address] = true
    if (!connections[address])
      return console.log('blocked')
    connections[address].remote.end()
    console.log('blocked & kicked')
  },
  'allow': function (params, con) {
    const address = params.join('')
    if (!blockedAddresses[address])
      return console.log('address already allowed')
    delete blockedAddresses[address]
    console.log('allowed')
  }
}

function inspect (data, local) {
  return false
}
