const {Client, Intents} = require("discord.js")
const {token} = require("./config.json")
const Raid = require("./games/raid")
const Waifu = require("./games/waifu")
const Market = require("./games/market")
// const BlackMarket = require("./games/black_market")
const RolePlay = require("./games/role_play")
const Simp = require("./games/simp")

// just demo


// define bots permissions.
const client = new Client({
    intents:
        [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.DIRECT_MESSAGES,
            Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
            Intents.FLAGS.GUILD_MEMBERS
        ]
})

Raid(client)
// Waifu(client)
Market(client)
// BlackMarket(client)
RolePlay(client)
Simp(client)

client.login(token)