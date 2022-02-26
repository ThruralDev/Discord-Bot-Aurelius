const {MessageEmbed, MessageActionRow, MessageButton} = require("discord.js")
const fs = require("fs")
const Helpers = require("../utils/helper")

// map block
let mapUserCoolDown = new Map()
let mapUser = new Map()

// database block
const Mongoose = require("mongoose")
const {databaseUri, channel_bot_config_id, channel_raid_id} = require("../config.json")
const currencySchema = require("../schemas/currency")

// represent the runtime-data. This is the core-data for this file!
const {
    monster, weapons, channel, creation, loot, images_path_end, path_start
} = JSON.parse(fs.readFileSync("config/raid.json"))

// buttons below monster
const row = new MessageActionRow()
    .addComponents(new MessageButton()
        .setCustomId("sword")
        .setLabel("⚔️")
        .setStyle("PRIMARY"), new MessageButton()
        .setCustomId("magic")
        .setEmoji("<:knot:941834270064918569>")
        .setStyle("PRIMARY"))

const Player = {
    async getName(_interaction) {
        if (_interaction.member.nickname === null) {
            return _interaction.user.username
        }
        return _interaction.member.nickname
    },
    async trackAttack(_interaction, damage) {
        if (!mapUser.has(_interaction.user.id)) {
            mapUser.set(_interaction.user.id, {balance: damage, name: await Player.getName(_interaction)})
            monster.fightersTotal++
        } else {
            let curVal = mapUser.get(_interaction.user.id)
            mapUser.set(_interaction.user.id, {
                balance: (parseInt(curVal.balance) + damage), name: await Player.getName(_interaction)
            })
        }
        // put userid to cooldown
        mapUserCoolDown.set(_interaction.user.id, new Date(Date.now()))
    },
    async getFightFeedback(_interaction, _weapon, _damage) {
        // update monster embed and throw feedback
        await monster.data_channel.messages
            .fetch(monster.id)
            .then(async msg => {
                await msg.edit({
                    embeds: [await Monster.generateMonsterEmbed(monster.data)]
                })
                if (_damage === 0) {
                    if (_weapon.name === "magic") {
                        _interaction.reply({
                            content: "You forgot to study, turns out glyphs are hard to remember when you're in battle. You dealt no damage.",
                            ephemeral: true
                        })
                    }
                    return
                }
                _interaction.reply({content: _weapon.fightMessages[_damage - _weapon.offset], ephemeral: true})
            })
    }
}
const Game = {
    async processDamage(_damage) {
        monster.health.points_remain -= _damage
        return monster.health.points_remain <= 0

    },
    resetRaid() {
        creation.state = 0
        creation.is_creation = false
        monster.is_spawned = false
        monster.fightersTotal = 0
        monster.health.bar = monster.health.resetBar
        mapUserCoolDown = new Map()
        mapUser = new Map()
    },
    async getRichestPlayer(_msg, _n) {
        await currencySchema.find().sort({balance: -1}).limit(_n).then((_stats) => {
            let embed = new MessageEmbed()
                .setColor("#0099ff")
                .setTitle(`These are the ${_stats.length} richest Player:`)
            for (let i = 0; i < _stats.length; i++) {
                let userName
                if (_stats[i].name === undefined) {
                    userName = "User had no fight and name yet in db. His ID is " + _stats[i].playerID
                } else {
                    userName = _stats[i].name
                }
                embed.addField(`Top ${i + 1}`, `**${userName}** with **${_stats[i].balance}** Erums.`)
            }
            _msg.reply({embeds: [embed]})
        })
    },
    /**
     * fetch the timestamp of users last attack and check if the timer is ran out. If so the function returns true and the attack goes on.
     * Otherwise not and give user an information how much time is left to rest.
     * @author Thrural | Eyes Of Ignolia
     * @param _interaction data about the interaction, in order to get users id and reply to it for spawn feedback.
     * @returns boolean
     **/
    async checkUsersCoolDown(_interaction) {
        let timerDiff = mapUserCoolDown.get(_interaction.user.id) - new Date(Date.now())
        if (timerDiff > -(channel.timers.cooldown)) {
            await _interaction.editReply({
                content: `You're exhausted! Still rest ${new Date(channel.timers.cooldown - Math.abs(timerDiff)).toISOString().substr(14, 5)} mins left!`,
                ephemeral: true
            })
            return false
        }
        return true
    },
    async rewardUsers() {
        // sorts the map of points from highest to lowest
        let sortedMap = new Map([...mapUser].sort((a, b) => b[1].balance - a[1].balance))
        // iterating through map and reward each fighter with increasing balance with damage.
        let bulkArr = []
        for (const [key, value] of sortedMap.entries()) {
            bulkArr.push({
                updateOne: {
                    "filter": {playerID: key},
                    "update": {$set: {name: value.name}, $inc: {balance: value.balance}},
                    "upsert": true
                }
            })
        }
        await currencySchema.bulkWrite(bulkArr)
    },
    /**
     * Go through the steps of assissted monster configuration in the bot-config channel.
     * @author Thrural | Eyes Of Ignolia
     * @param _msg data about the message, in order to reply to it for spawn feedback.
     **/
    creationStep(_msg) {
        if (creation.state === monster.index_health) {
            // proof if input for lifepoints is a number
            if (!Helpers.checkIfNumber(_msg.content)) {
                Game.resetRaid()
                _msg.reply("Sorry, you dont provided a numeric value for lifepoints. Creation process was reset.")
                return
            }
            monster.health.points_total = parseInt(_msg.content)
            monster.health.points_remain = monster.health.points_total
            monster.health.divisor = monster.health.points_total / monster.health.sections
        }

        // check input
        if (creation.state === monster.index_image) {
            if (!Game.checkImageInput(_msg)) return
            monster.data[creation.state].value = path_start + _msg.content.trim()
        } else {
            monster.data[creation.state].value = _msg.content.trim()
        }

        creation.state++
        if (creation.state !== monster.data.length && creation.state !== monster.index_image) {
            _msg.channel.send(monster.data[creation.state].request)
            return
        }
        if (creation.state !== monster.data.length) {
            // extra handling text for image because of dynamic generation of options
            _msg.channel.send(`Please insert the ending of the monster's file in the monster directory. The possible inputs are: **${images_path_end.monsters.join("**, **")}**`)
        }
    },
    checkImageInput(_msg) {
        if (!images_path_end.monsters.includes(_msg.content)) {
            let embed = new MessageEmbed()
                .setColor("#0099ff")
                .setTitle("Image not included!")
                .setDescription("Monster creation reset. These inputs are possible:")
            for (const i of images_path_end.monsters) {
                embed.addField("- - - - -", `**${i}**`)
            }
            _msg.reply({embeds: [embed], inline: true})
            Game.resetRaid()
            return false
        }
        return true
    }
}
const Monster = {
    /**
     * Is needed to generate/update the monster's data. It finally executes the action.
     * @author Thrural | Eyes Of Ignolia
     * @param _data monster's data after interaction with button.
     * @type {_data : Object}
     **/
    generateMonsterEmbed(_data) {
        return new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(_data[0].value)
            .setDescription(_data[1].value)
            .addFields([{
                name: "Healthpoints:",
                value: `${monster.health.padding_left + monster.health.bar + monster.health.padding_right + " " + monster.health.points_remain + "|" + monster.health.points_total}`
            }, {name: "Total fighters:", value: monster.fightersTotal.toString()}])
            .setImage(_data[monster.index_image].value)
    },
    /**
     * Get the channel-id of config to spawn monster in there with the weapon buttons.
     * Save the id of monster embed.
     * Also switch the states of game like is_spawned and is_created.
     * @author Thrural | Eyes Of Ignolia
     * @param _msg data about the message, in order to reply to it for spawn feedback.
     * @type {_msg : Object}
     **/
    async spawnMonster(_msg) {
        await monster.data_channel
            .send({embeds: [await Monster.generateMonsterEmbed(monster.data)], components: [row]})
            .then(async (_channel) => {
                const collector = _channel.createMessageComponentCollector({componentType: "BUTTON"})
                collector.on("collect", async i => {
                    if (i.customId === "sword") {
                        await Game.checkUsersCoolDown(i).then(async (_state) => {
                            if (_state) {
                                await Monster.updateMonster(i, weapons[0])
                            }
                        })
                    }
                    if (i.customId === "magic") {
                        if (!Game.checkUsersCoolDown(i)) return
                        await Monster.updateMonster(i, weapons[1])
                    }
                })
                collector.on("end", collected => {
                    console.log(`Collected ${collected.size} interactions in spawnMonster.`)
                })
                await monster.data_channel.messages
                    .fetch({limit: 1})
                    .then(messages => {
                        monster.id = messages.first().id
                        creation.is_creation = false
                        monster.is_spawned = true
                        _msg.channel.send(`Monster with the name **${monster.data[0].value}** spawned!`)
                    })
                    .catch(console.error)
            })
    },
    /**
     * Update the existing embed's data of the monster like the healthbar and the amount of fighters.
     * After that call the Monster.generateMonsterEmbed-Function to generate the actual embed.
     * Also put user's id to cooldown queue and increase the achieved damage points of the fight.
     * @author Thrural | Eyes Of Ignolia
     * @param _interaction client's data about interaction with button.
     * @param _weapon data about the current weapon the client clicked on.
     * @type {_interaction : Object, _weapon : Object}
     **/
    async calcDamageWeapons(_weapon) {
        let damage = Math.floor(Math.random() * (_weapon.fightMessages.length)) + _weapon.offset
        if (!(Math.random() < _weapon.accuracy)) damage = 0
        return damage
    },
    async updateHealthBar() {
        let _nFull = Math.ceil(monster.health.points_remain / monster.health.divisor)
        let _nEmpty = monster.health.sections - _nFull
        monster.health.bar = (new Array(_nFull + 1).join(monster.health.sign_full) + new Array(_nEmpty + 1).join(monster.health.sign_empty))
    },
    async updateMonster(_interaction, _weapon) {
        await this.calcDamageWeapons(_weapon).then(async (damage) => {
            await Loot.generateDropEmbed(_interaction).then(async () => {
                await Player.trackAttack(_interaction, damage).then(async () => {
                    await Game.processDamage(damage).then(async (_is_dead) => {
                        if (!_is_dead) {
                            await this.updateHealthBar(_interaction, _weapon, damage).then(async () => {
                                await Player.getFightFeedback(_interaction, _weapon, damage)
                            })
                            return
                        }
                        await this.killMonster(_interaction, damage)
                    })
                })
            })
        })
    },
    async killMonster(_interaction, _damage) {
        let embed = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(`${monster.data[0].value} has been defeated!`)
            .setDescription("Congratulations on defeating the foe. You've helped protect Ignolia.")
        // bonus last hit
        let bonusLastHit = 15
        mapUser.set(_interaction.user.id, {
            balance: await mapUser.get(_interaction.user.id).balance + bonusLastHit,
            name: await Player.getName(_interaction)
        })
        // sorts the map of points from highest to lowest
        let sortedMapPoints = new Map([...mapUser].sort((a, b) => b[1].balance - a[1].balance))
        let counter = 1
        let bonusTop = [25, 15, 5]
        for (let [key, value] of sortedMapPoints) {
            let placeholder = ""
            if(counter - 1 < 3){
                mapUser.set(key, {
                    balance: await mapUser.get(key).balance + bonusTop[counter - 1],
                    name: await Player.getName(_interaction)
                })
                placeholder = `+ **Bonus**: ${bonusTop[counter - 1]} \uD83E\uDE99`
            }
            if (counter > channel.award_amount && sortedMapPoints.size > channel.award_amount) break
            embed.addField(`Rank ${counter}:`, `**${value.name}** with ${value.balance.toString()} granted points ${placeholder}`)
            counter++
        }
        await monster.data_channel.messages
            .fetch(monster.id).then(async msg => {
                await msg.delete()
            }).then(async () => {
                await monster.data_channel.send({embeds: [embed]}).then(async () => {
                    _interaction.reply({content: `You gave him the final Blow! For that you get a Bonus of ${bonusLastHit} Points! \uD83E\uDE99`, ephemeral: true})
                    _interaction.channel.send(`:tada: **${await Player.getName(_interaction)}** killed the beast with ${_damage} damage! :tada:`)
                })
                await Game.rewardUsers().then(async () => {
                    await Game.resetRaid()
                })
            })
    }
}
const Loot = {
    generateClaimEmbed(_color, _title, _description = "") {
        return new MessageEmbed()
            .setColor(_color)
            .setTitle(_title)
            .setDescription(_description)
    },
    generateRow(_customID, _emoji, _label, _color, _disabled) {
        return new MessageActionRow()
            .addComponents(new MessageButton()
                .setCustomId(_customID)
                .setEmoji(_emoji)
                .setLabel(_label)
                .setStyle(_color)
                .setDisabled(_disabled))
    },
    async generateDropEmbed() {
        if (Math.random() < 0.9 || loot.last_drop_id !== null || loot.last_drop_coin_amount !== null) return
        const randomScope = 7
        const randomStart = 3
        loot.last_drop_coin_amount = Math.floor((Math.random() * randomScope) + randomStart)
        let embed = await Loot.generateClaimEmbed("#0099ff", "Monster has dropped something!", "Look! I can't believe my Eyes! Is this Gold?!")
        const row = await Loot.generateRow("claim-coins", "🪙", `Claim ${loot.last_drop_coin_amount} Erums!`, "PRIMARY", false)
        await monster.data_channel
            .send({embeds: [embed], ephemeral: true, components: [row]})
            .then((emb) => {
                const collector = emb.createMessageComponentCollector({max: 1, componentType: "BUTTON"})
                collector.on("collect", async i => {
                    console.log("claim was clicked by ", i.user.username, " and is the only one who claimed it!")
                    await emb.delete().then(async () => {
                        await Loot.claimLoot(i, emb)
                    })
                })

                collector.on("end", collected => {
                    console.log(`Collected ${collected.size} claim interactions in drop embed.`)
                })
                emb
                    .fetch({limit: 1})
                    .then(messages => {
                        loot.last_drop_id = messages.id
                    })
                    .catch(console.error)
            })
    },
    async claimLoot(_interaction) {
        await currencySchema.updateOne({playerID: _interaction.user.id}, {
            $set: {name: await Player.getName(_interaction)}, $inc: {balance: loot.last_drop_coin_amount}
        }, {upsert: true}).then(async () => {
            await _interaction.channel.send(`\uD83E\uDE99 **${await Player.getName(_interaction)}** has claimed ${loot.last_drop_coin_amount} coins!`).then(async (el) => {
                setTimeout(() => {
                    el.delete()
                    loot.last_drop_coin_amount = null
                    loot.last_drop_id = null
                }, 3000)
            })
        })
    }
}

module.exports = (_client) => {
    _client.on("ready", async () => {
        console.log("Bot is running!")
        await Mongoose.connect(databaseUri || "", {
            keepAlive: true
        }, err => {
            if (err) {
                console.log(err)
                return
            }
            console.log("successfully connected to bot's database in raid!")
        })
        // just for shorting at functions
        monster.data_channel = _client.channels.cache.get(channel_raid_id)
    })

    _client.on("messageCreate", async _msg => {
        if (_msg.author.bot || _msg.channel.id !== channel_bot_config_id) return
        // handle input/commands
        let command = Helpers.composeWithDash(_msg.content)
        if (command === "!rcreate" && Helpers.auth(_msg)) {
            Game.resetRaid()
            _msg.channel.send(monster.data[0].request)
            creation.is_creation = true
            return
        }
        if (command === "!rcancel" && Helpers.auth(_msg) && creation.is_creation) {
            Game.resetRaid()
            _msg.channel.send("raid reset successfully! Try 'Another One'")
            return
        }
        if (command === "!rich" && Helpers.auth(_msg)) {
            await Game.getRichestPlayer(_msg, 10)
            return
        }
        if (creation.is_creation && !monster.is_spawned && Helpers.auth(_msg)) {
            Game.creationStep(_msg)
            // on last step
            if (creation.state === monster.data.length) {
                await Monster.spawnMonster(_msg)
                creation.is_creation = false
            }
        }
    })
}