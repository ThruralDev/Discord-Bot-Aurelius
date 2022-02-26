const {MessageAttachment} = require("discord.js")
const Helpers = require("../utils/helper")
const fs = require("fs")
const Canvas = require("canvas")

const {channel_simp_ids} = require("../config.json")
const {roles} = JSON.parse(fs.readFileSync("config/simp.json", "utf-8"))

const Simp = {
    getUserInfo(_user, _msg) {
        let name
        !_user.nickname ? name = _user.user.username : name = _user.nickname
        for (let i of roles) {
            if (_user.roles.cache.some(role => role.name === i)) {
                return [name, i.split(" ")[1].toLowerCase()]
            }
        }
        _msg.reply("The User you pinged is not Part of a Waifu-Team.")
        return false
    }, async drawCanvas(_msg, _user, _image, w, h, _text) {
        const canvas = Canvas.createCanvas(parseInt(w), parseInt(h))
        const context = canvas.getContext("2d")

        const background = await Canvas.loadImage(_image)
        context.drawImage(background, 0, 0, canvas.width, canvas.height)
        context.beginPath()

        function roundRect(x0, y0, x1, y1, r, color) {
            let w = x1 - x0
            let h = y1 - y0
            if (r > w / 2) r = w / 2
            if (r > h / 2) r = h / 2
            context.beginPath()
            context.moveTo(x1 - r, y0)
            context.quadraticCurveTo(x1, y0, x1, y0 + r)
            context.lineTo(x1, y1 - r)
            context.quadraticCurveTo(x1, y1, x1 - r, y1)
            context.lineTo(x0 + r, y1)
            context.quadraticCurveTo(x0, y1, x0, y1 - r)
            context.lineTo(x0, y0 + r)
            context.quadraticCurveTo(x0, y0, x0 + r, y0)
            context.closePath()
            context.fillStyle = color
            context.fill()
        }

        function placeText(_text_divided, _x, _y) {
            // seperated by commas, one block can have a max size of 16
            let rows = ""
            let firstRowLimit = 15
            let isFirstRowFilled = false
            for (let i = 0; i < _text_divided.length; i++) {
                // always push first in
                if (i === 0) {
                    rows += " " + _text_divided[i]
                    if (_text_divided.length === 1 && rows.length > firstRowLimit) {
                        rows = [rows.slice(0, firstRowLimit), ":#:", rows.slice(firstRowLimit)].join(" ")
                    }
                    continue
                }
                // check if next insert would overfill the max for one row
                if (!isFirstRowFilled && (rows + _text_divided[i]).length < firstRowLimit + 1) {
                    rows += " " + _text_divided[i]
                    continue
                }
                // if code reach here, the first row is full and next can be initialized.
                if (!isFirstRowFilled && i === _text_divided.length) {
                    break
                }
                if (!isFirstRowFilled) {
                    rows += ":#:"
                    isFirstRowFilled = true
                }
                rows += " " + _text_divided[i]
            }
            let bricks = rows.split(":#:")
            context.font = "600 32px sans-serif"
            context.fillStyle = "#232323"
            if (bricks.length === 2) {
                context.fillText(bricks[0], _x, _y)
                context.fillText(bricks[1], _x, _y + 40)
                return
            }
            context.fillText(bricks[0], _x, _y)
        }

        roundRect(82, 85, 342, 346, 25, true)
        placeText(_text.split(" "), 73, 385)
        context.closePath()
        context.clip()
        const avatar = await Canvas.loadImage(_user.displayAvatarURL({format: "jpg"}))
        context.drawImage(avatar, 66, 66, 300, 300)
        const attachment = new MessageAttachment(canvas.toBuffer(), _image)
        _msg.reply({files: [attachment]})
    }, async getUser(_client, _msg, _id) {
        let member = _msg.guild.members.cache.get(_id)
        let team = Simp.getUserInfo(member, _msg)
        if (!team) return
        await Simp.drawCanvas(_msg, member, `src/simp/${team[1]}.png`, 1100, 635, team[0])
    }
}

const Checker = {
    hasRole(_msg, _role) {
        return _msg.member.roles.cache.some(role => role.name === _role)
    }, checkChannel(_obj, _ids) {
        return _ids.some(el => el === _obj.channel.id)
    }, validatePing(_msg, _this) {
        if (17 < _this.replace(/\D/, "").length < 19) {
            return true
        }
        _msg.reply("You have to ping a User with @..")
        return false
    }, validateLength(_msg, _this) {
        if (_this.length !== 2) {
            _msg.reply("Your Input must have 2 Arguments seperated by whitespace.")
            return false
        }
        return true
    }
}

module.exports = (_client) => {
    _client.on("ready", () => {
        console.log("Simp active!")
    })

    _client.on("messageCreate", async _msg => {
        if (_msg.author.bot || !Checker.checkChannel(_msg, channel_simp_ids)) return
        let command = Helpers.composeWithDash(_msg.content)
        if (command.startsWith("!simp")) {
            if (!Checker.validateLength(_msg, command.split("-"))) return
            if (!Checker.validatePing(_msg, command.split("-")[1])) return
            await Simp.getUser(_client, _msg, command.split("-")[1].replace(/\D/g, ""))
        }
    })
}