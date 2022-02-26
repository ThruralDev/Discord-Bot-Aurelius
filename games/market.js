const {MessageEmbed, MessageActionRow, MessageButton} = require("discord.js")
const Helpers = require("../utils/helper")
const fs = require("fs")

// database stuff
const Mongoose = require("mongoose")
const {databaseUri, channel_kl_id, channel_market_id} = require("../config.json")
const schemaKingslist = require("../schemas/kingslist")
const schemaCurrency = require("../schemas/currency")
const schemaPantsu = require("../schemas/pantsu")
// partner WL
const schemaTrapMonkey = require("../schemas/partners/trapmonkey")

const {channel, items, messages, embed_color} = JSON.parse(fs.readFileSync("config/market.json"))
let M = {
    channel: channel, items: items, messages: messages, embedColor: embed_color
}

function generateActionEmbed(_msg) {
    const row = new MessageActionRow()
        .addComponents(new MessageButton()
            .setCustomId(M.messages.buttons.action_items.custom_id)
            .setLabel(M.messages.buttons.action_items.label)
            .setStyle(M.messages.buttons.action_items.style)
            .setEmoji(M.messages.buttons.action_items.emoji), new MessageButton()
            .setCustomId(M.messages.buttons.action_balance.custom_id)
            .setLabel(M.messages.buttons.action_balance.label)
            .setStyle(M.messages.buttons.action_balance.style)
            .setEmoji(M.messages.buttons.action_balance.emoji))
    let embed = new MessageEmbed()
        .setColor(M.embedColor)
        .setTitle(M.messages.embeds.action.title)
        .setDescription(M.messages.embeds.action.description)
    _msg.channel.send({embeds: [embed], components: [row]})
}

async function generateBalanceEmbed(_interaction) {
    let query = await schemaCurrency.findOne({playerID: _interaction.user.id})
    let embed = new MessageEmbed()
        .setColor(M.embedColor)
        .setTitle("Balance Information")
        .setDescription("Let me see how much you have on your wallet... ah here it is:")
        .addField("You own:", "**" + query.balance + "** Erums 🪙")
    await _interaction.editReply({embeds: [embed]})
}

async function generateItemsEmbed(_interaction) {
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(M.messages.buttons.buy_kingslist.custom_id)
                .setLabel(M.messages.buttons.buy_kingslist.label)
                .setEmoji(M.messages.buttons.buy_kingslist.emoji)
                .setStyle(M.messages.buttons.buy_kingslist.style),
            new MessageButton()
                .setCustomId(M.messages.buttons.buy_pantsu.custom_id)
                .setLabel(M.messages.buttons.buy_pantsu.label)
                .setEmoji(M.messages.buttons.buy_pantsu.emoji)
                .setStyle(M.messages.buttons.buy_pantsu.style),
            new MessageButton()
                .setCustomId(M.messages.buttons.buy_kingslist_trapmonkey.custom_id)
                .setLabel(M.messages.buttons.buy_kingslist_trapmonkey.label)
                .setEmoji(M.messages.buttons.buy_kingslist_trapmonkey.emoji)
                .setStyle(M.messages.buttons.buy_kingslist_trapmonkey.style))
    let embed = new MessageEmbed()
        .setColor(M.embedColor)
        .setTitle(M.messages.embeds.items.title)
        .setDescription(M.messages.embeds.items.description)
    let sizeKingslist = await schemaKingslist.countDocuments()
    let sizePantsuList = await schemaPantsu.countDocuments()
    let sizeTrapMonkey = await schemaTrapMonkey.countDocuments()
    M.items.forEach((item, index) => {
        // for kingslist
        if (index === 0) {
            if (sizeKingslist >= M.items[0].onstock) {
                embed.addField(item.name + " " + item.emoji + " [SOLD OUT]", `~~Costs **${item.costs}** Erums 🪙 and **${item.onstock - sizeKingslist}** in stock!~~`)
            } else {
                embed.addField(item.name + " " + item.emoji, `Costs **${item.costs}** Erums 🪙 and **${item.onstock - sizeKingslist}** in stock!`)
            }
        }
        if (index === 1) {
            if (sizePantsuList >= M.items[1].onstock) {
                embed.addField(item.name + " " + item.emoji + " [SOLD OUT]", `~~Costs **${item.costs}** Erums 🪙 and **${item.onstock - sizePantsuList}** in stock!~~`)
            } else {
                embed.addField(item.name + " " + item.emoji, `Costs **${item.costs}** Erums 🪙 and **${item.onstock - sizePantsuList}** in stock!`)
            }
        }
        if(index === 2){
            if (sizeTrapMonkey >= M.items[2].onstock) {
                embed.addField(item.name + " " + item.emoji + " [SOLD OUT]", `~~Costs **${item.costs}** Erums 🪙 and **${item.onstock - sizeTrapMonkey}** in stock!~~`)
            } else {
                embed.addField(item.name + " " + item.emoji, `Costs **${item.costs}** Erums 🪙 and **${item.onstock - sizeTrapMonkey}** in stock!`)
            }
        }
    })
    await _interaction.editReply({embeds: [embed], components: [row]})
}

async function checkBalanceItem(_interaction, _item) {
    let embed = new MessageEmbed()
        .setColor(M.embedColor)
        .setTitle(M.messages.embeds.insufficient_balance.title)
        .setDescription(M.messages.embeds.insufficient_balance.description)
    let query = await schemaCurrency.findOne({playerID: _interaction.user.id})
    if (query.balance < _item.costs) {
        await _interaction.editReply({
            embeds: [embed], ephemeral: true
        })
        return false
    }
    return true
}

async function checkPosses(_obj, _user) {
    let embed = new MessageEmbed()
        .setColor(M.embedColor)
        .setTitle("Fight first!")
        .setDescription("I dont hear coins in your pouch. So return, when you have something to spend.")
    if (await schemaCurrency.findOne({playerID: _user})) {
        return true
    }
    await _obj.editReply({embeds: [embed]})
    return false
}

async function checkHasEntry(_interaction, _schema) {
    if (await _schema.findOne({playerID: _interaction.user.id})) {
        await _interaction.editReply({content: "You‘ve already bought this item!"})
        return true
    }
    return false
}

async function purchaseRole(_interaction, _item, _role, _schema) {
    // handle guild- and usernames
    let usersName = _interaction.member.nickname
    if (usersName === null) usersName = _interaction.user.username
    // update users balance
    schemaCurrency
        .updateOne({playerID: _interaction.user.id}, {
            $set: {name: usersName},
            $inc: {balance: -_item.costs}
        }, {upsert: true}, (err) => {
            if (err) {
                console.log("Update balance after ", _item.name, "-purchase of ", usersName, " failed!")
                return
            }
            console.log("Update balance after ", _item.name, "-purchase of ", usersName, " succeed!")
            // append role to buyer
            const role = _interaction.guild.roles.cache.find(role => role.name === _role)
            let member = _interaction.guild.members.cache.get(_interaction.user.id)
            member.roles.add(role)
            // post user to DB schema
            _schema
                .updateOne(
                    {playerID: _interaction.user.id},
                    {$set: {name: usersName}},
                    {upsert: true},
                    (err) => {
                        if (err) {
                            console.log("Update DB after ", _item.name, "-purchase of ", usersName, " failed!")
                            return
                        }
                        let replyMessage = _item.purchase_message
                            .replace("USERID", _interaction.user.id)
                            .replace("KLCHANNELID", channel_kl_id)
                        _interaction.editReply(replyMessage)
                        console.log("Update DB after ", _item.name, "-purchase of ", usersName, " succeed!")
                    }
                )
        })
}

async function checkSoldOut(_interaction, _item, _schema) {
    let amount = await _schema.countDocuments()
    if (amount >= _item.onstock) {
        await _interaction.editReply("This Item is sold out!")
        return true
    }
    return false
}

async function routeActions(_interaction) {
    if (_interaction.customId === "balance") {
        if (!await checkPosses(_interaction, _interaction.user.id)) return
        await generateBalanceEmbed(_interaction)
        return
    }
    if (_interaction.customId === "items") {
        await generateItemsEmbed(_interaction)
        return
    }
    if (_interaction.customId === "kingslist") {
        let itemData = M.items[0]
        if (await checkSoldOut(_interaction, itemData, schemaKingslist)) return
        if (!await checkPosses(_interaction, _interaction.user.id)) return
        if (await checkHasEntry(_interaction, schemaKingslist)) return
        if (!await checkBalanceItem(_interaction, itemData)) return
        await purchaseRole(_interaction, itemData, "Kingslisted", schemaKingslist)
    }

    if (_interaction.customId === "pantsu") {
        let itemData = M.items[1]
        if (await checkSoldOut(_interaction, itemData, schemaPantsu)) return
        if (!await checkPosses(_interaction, _interaction.user.id)) return
        if (await checkHasEntry(_interaction, schemaPantsu)) return
        if (!await checkBalanceItem(_interaction, itemData)) return
        await purchaseRole(_interaction, itemData, "LAND OF PANTSU", schemaPantsu)
    }

    if (_interaction.customId === "kingslist_trapmonkey") {
        let itemData = M.items[2]
        if (await checkSoldOut(_interaction, itemData, schemaTrapMonkey)) return
        if (!await checkPosses(_interaction, _interaction.user.id)) return
        if (await checkHasEntry(_interaction, schemaTrapMonkey)) return
        if (!await checkBalanceItem(_interaction, itemData)) return
        await purchaseRole(_interaction, itemData, "TrapMonkie", schemaTrapMonkey)
    }
}

async function checkBalanceSend(_msg, _cost) {
    let query = await schemaCurrency.findOne({playerID: _msg.author.id})
    return query.balance >= _cost;
}

async function sendCoins(_msg, _blocks) {
    if (_blocks.length !== 3) {
        _msg.reply("You have to provide '!send' with mentioned Recepient and Amount")
        return
    }
    if (!Helpers.checkIfNumber(_blocks[2])) {
        _msg.reply("Please provide a numeric value for amount.")
        return
    }

    if (!_blocks[1].startsWith("<@") || !_blocks[1].endsWith(">")) {
        _msg.reply("You have to mention your recepient with '@..'")
        return
    }
    let recepientsID = _blocks[1].replace(/\D/g, "")
    console.log("id of recepient: ",recepientsID)
    if (!await checkPosses(_msg, _msg.author.id)) return
    if (!await checkBalanceSend(_msg, parseInt(_blocks[2]))) {
        _msg.reply("You dont have enough Erum!")
        return
    }
    // update recepients balance
    schemaCurrency
        .updateOne(
            {playerID: recepientsID},
            {$inc: {balance: +parseInt(_blocks[2])}},
            {upsert: true},
            (err) => {
                if (err) {
                    console.log("something went wrong on adding balance to target account")
                    return
                }
                console.log("updated recepient successfully!")
            })
    // update senders balance
    schemaCurrency
        .updateOne(
            {playerID: _msg.author.id},
            {$inc: {balance: -parseInt(_blocks[2])}},
            {},
            (err) => {
                if (err) {
                    console.log("something went wrong on subtracting balance of senders account")
                    return
                }
                _msg.reply(`You successfully sent **${_blocks[2]}** Erums to your fren!`)
                console.log("updated senders balance successfully!")
            })
}

module.exports = (_client) => {
    _client.on("ready", async () => {
        await Mongoose.connect(databaseUri || "", {
            keepAlive: true
        }, err => {
            if (!err) {
                console.log(M.messages.logs.success.connected)
                return
            }
            console.log(err)
        })
    })

    _client.on("interactionCreate", async _interaction => {
        if(
            !_interaction.isButton() ||
            _interaction.user.bot ||
            _interaction.channel.id !== channel_market_id
        ) return
        await _interaction.deferReply({ephemeral: true})
        await routeActions(_interaction)
    })

    _client.on("messageCreate", async _msg => {
        if (_msg.author.bot || _msg.channel.id !== channel_market_id) return

        let command = Helpers.composeWithDash(_msg.content)
        if (command === "!market-help") {
            _msg.reply(M.messages.help)
            return
        }

        if (command === "!market") {
            generateActionEmbed(_msg)
        }

        if (command.startsWith("!send")) {
            await sendCoins(_msg, command.split("-"))
        }
    })
}