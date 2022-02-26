const {MessageEmbed, MessageActionRow, MessageButton} = require("discord.js")
const Helpers = require("../utils/helper")
const fs = require("fs")

// database stuff
const Mongoose = require("mongoose")
const {databaseUri, channel_assassins_id, channel_slaves_id, channel_kl_id} = require("../config.json")
const schemaCurrency = require("../schemas/currency")

const {messages, timers, steal_procent} = JSON.parse(fs.readFileSync("config/role_play.json"))

const Checker = {
    hasRole(_msg, _role) {
        return _msg.member.roles.cache.some(role => role.name === _role)
    }, checkChannel(_obj, _ids) {
        return _ids.some(el => el === _obj.channel.id)
    }, async purchaseRole(_msg, _role) {
        const role = _msg.guild.roles.cache.find(role => role.name === _role)
        let member = _msg.guild.members.cache.get(_msg.author.id)
        member.roles.add(role)
    }
}

const Getter = {
    getRemainingTime(_player, _stamp) {
        return new Date(timers.cool_down - (Date.now() - _stamp)).toISOString().slice(11, -5).toString()
    }, generateFeedback(_message_arr, _amount, _chance) {
        return _message_arr[Math.floor(Math.random() * _message_arr.length)]
            .replace("**AMOUNT**", `**${_amount}**`)
    }
}

const Assassins = {
    async stealCoins(_msg, _id, _val, _chance) {
        // subtract coins from target
        schemaCurrency
            .updateOne({playerID: _id}, {$inc: {balance: -_val}}, {upsert: true}, (err) => {
                if (err) {
                    console.log("something went wrong on subtracting coins form target's Account")
                    return
                }
                console.log("successfully stole coins!")
                // update senders balance
                schemaCurrency
                    .updateOne({playerID: _msg.author.id}, {
                        $set: {time_stamp: Date.now()},
                        $inc: {balance: _val}
                    }, {}, (err) => {
                        if (err) {
                            console.log("something went wrong on adding the stolen coins to assassins Account")
                            return
                        }
                        _msg.reply(Getter.generateFeedback(messages.assassin.success, _val))
                        console.log("updated assassins balance successfully!")
                    })
            })
    }
}

const Slaves = {
    updateBalance(_msg, value) {
        schemaCurrency
            .updateOne({playerID: _msg.author.id}, {
                $set: {name: _msg.author.username, time_stamp: Date.now()}, $inc: {balance: value}
            }, {upsert: true}, (err) => {
                if (err) {
                    console.log("something went wrong on updating the balance of slave with salary: ", err)
                    return
                }
                _msg.reply(Getter.generateFeedback(messages.slaves.work, value))
                console.log("updated users balance successfully!")
            })
    }, calcSalary(_msg) {
        if (Checker.hasRole(_msg, "Hash Provider")) {
            return 115
        }
        return 100
    }
}

async function connectDB() {
    await Mongoose.connect(databaseUri || "", {
        keepAlive: true
    }, err => {
        if (!err) {
            console.log(messages.logs.success.connected)
            return
        }
        console.log(err)
    })
}

module.exports = (_client) => {
    _client.on("ready", async () => {
        await connectDB()
    })

    _client.on("messageCreate", async _msg => {
        if (_msg.author.bot || !Checker.checkChannel(_msg, [channel_slaves_id, channel_assassins_id])) return

        let command = Helpers.composeWithDash(_msg.content)

        if (command.startsWith("!work") && Checker.checkChannel(_msg, [channel_slaves_id])) {
            let query = await schemaCurrency.findOne({playerID: _msg.author.id})
            if (!query) {
                Slaves.updateBalance(_msg, Slaves.calcSalary(_msg))
                console.log("player has no Account. No he have one.")
                return
            }
            if (!query.time_stamp) {
                Slaves.updateBalance(_msg, Slaves.calcSalary(_msg))
                console.log("player has no timestamp. Now he have one.")
                return
            }
            // check if timestamp is invalid
            if (Date.now() - query.time_stamp < timers.cool_down) {
                let remainingTime = Getter.getRemainingTime(_msg.author.id, query.time_stamp)
                _msg.reply(`You're too tired to do anything. Remaining Time: ${remainingTime}`)
                return
            }
            Slaves.updateBalance(_msg, Slaves.calcSalary(_msg))
        }

        if (command.startsWith("!target") && Checker.checkChannel(_msg, [channel_assassins_id])) {
            if (command.split("-").length !== 2) {
                _msg.reply("You have to write '!target' and then ping the Player you want to steal Erums.")
                return
            }
            let query = await schemaCurrency.findOne({playerID: _msg.author.id})
            if (!query) {
                console.log("Target has no Account.")
                _msg.reply("It seems you have no Pouch to put in your Coins. Earn some Erums to have one.")
                return
            }
            if (Date.now() - query.time_stamp < timers.cool_down) {
                let remainingTime = Getter.getRemainingTime(_msg.author.id, query.time_stamp)
                _msg.reply(`You're too tired to do anything. Remaining Time: ${remainingTime}`)
                return
            }

            // check if target has no Account or 0 balance
            let idTarget = command.split("-")[1].replace(/\D/g, "").trim()
            console.log(idTarget)
            let queryTarget = await schemaCurrency.findOne({
                playerID: idTarget
            })
            if (!queryTarget) {
                _msg.reply("Target has no pouch to grab!")
                return
            }
            if (queryTarget.balance <= 0) {
                _msg.reply({content: "The Target's Pouch does not ring with coins", ephemeral: true})
                return
            }

            await schemaCurrency.find().sort({balance: -1}).limit(1).exec().then(async (kark) => {
                let valHighest = kark[0].balance
                await schemaCurrency.find({
                    playerID: idTarget
                }).then(async (el) => {
                    let factor = 1.01
                    let valTarget = el[0].balance
                    let procentOfTotal = Math.floor((valTarget / (valHighest * factor)) * 100) / 100
                    let chance = 1 - procentOfTotal
                    console.log(`Target has ${procentOfTotal} of highest balance value. And the chance to rub him is ${chance}`)
                    let amountCoins = Math.ceil(valTarget * steal_procent)
                    if (Math.random() < chance) {
                        await Assassins.stealCoins(_msg, idTarget, amountCoins, chance * 100 / 100)
                        return
                    }
                    if (Math.random() < 0.5) {
                        let coinsToLose = Math.floor(query.balance * .03)
                        schemaCurrency
                            .updateOne({playerID: _msg.author.id}, {$inc: {balance: -coinsToLose}}, {upsert: true}, (err) => {
                                if (err) {
                                    console.log("something went wrong on subtracting coins form target's Account")
                                    return
                                }
                                console.log("successful updated coins after loose.")
                            })
                        if (!Checker.hasRole(_msg, "cursed")) {
                            await Checker.purchaseRole(_msg, "cursed")
                        }
                        _msg.reply(Getter.generateFeedback(messages.assassin.lost, coinsToLose))
                        return
                    }
                    _msg.reply(Getter.generateFeedback(messages.assassin.failed, amountCoins))
                })
            })
        }
    })
}