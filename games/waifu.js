const Helpers = require("../utils/helper")
const {MessageEmbed} = require("discord.js")
const fs = require("fs")

let {text, teams, riddles, channels, emojis, imagesQuestions, game} = JSON.parse(fs.readFileSync("config/waifu.json"))
const M = {
    text: text,
    teams: teams,
    riddles: Helpers.shuffleArray(riddles),
    channels: channels,
    emojisCountdown: emojis,
    images_questions: imagesQuestions,
    game: game
}

function getRandomThumb() {
    let rand = Math.floor(Math.random() * M.images_questions.length)
    return M.images_questions[rand]["url"]
}

function getSortedTeamStats() {
    let scores = []
    let waifuTeams = ["Azume", "Saya", "Zashima"]
    for (let i = 0; i < 3; i++) {
        scores.push({"name": waifuTeams[i], "score": M.teams[waifuTeams[i]].score})
    }
    return scores.sort(function (a, b) {
        return b.score - a.score
    })
}

function getBestOfTeam(_team_track) {
    let sortable = []
    for (let item in _team_track) {
        sortable.push([item, _team_track[item]])
    }
    sortable.sort(function (a, b) {
        return a[1] - b[1]
    })
    // return only required information
    return [sortable[0][1], sortable[2][1], sortable[1][1]]
}

function sendQuestion(_client, _counter) {
    let randomThumbnail = getRandomThumb()
    M.channels.forEach((value) => {
        const questionEmbed = new MessageEmbed()
            .setThumbnail(`${randomThumbnail}`)
            .setTitle(`Question ${_counter + 1}: `)
            .setColor(M.game.color_theme)
            .setDescription(M.riddles[_counter].question)
        _client.channels.cache.get(value.toString()).send({embeds: [questionEmbed]})
    })
}

function initGame(_client) {
    const welcomeEmbed = new MessageEmbed()
        .setTitle(M.text["welcomeEmbedTitle"])
        .setColor(M.game.color_theme)
        .setDescription(M.text["welcomeEmbedDescription"])
        .setThumbnail("https://cdn.discordapp.com/attachments/929737423225770034/939541413853560832/waifu_war.png")
    M.channels.forEach((value) => {
        _client.channels.cache.get(value.toString()).send({embeds: [welcomeEmbed]})
    })
}

function nextQuestion(_client, _counter) {
    M.channels.forEach((value) => {
        const questionEmbed = new MessageEmbed()
            .setTitle(M.text["nextQuestionTitle"])
            .setColor(M.game.color_theme)
        _client.channels.cache.get(value.toString()).send({embeds: [questionEmbed]})
            .then(function (embedMessage) {
                let t = 5
                let downloadTimer = setInterval(function () {
                    embedMessage.react(M.emojisCountdown[t])
                    if (t === 0) {
                        embedMessage.react(M.emojisCountdown[t])
                        clearInterval(downloadTimer)
                    }
                    t -= 1
                }, 1000)
            })
    })
    setTimeout(sendQuestion, 7000, _client, _counter)
}

function revealResult(_client, _msg, _result, _winner_info) {
    // increase the score of team and player
    let subtr = 3
    for (let i = 0; i < _winner_info.length; i++) {
        Object.assign(M.game.player_tracker[_winner_info[i].team], {
            "name": _winner_info[i].name,
            "scored": M.teams[_winner_info[i].team].score += subtr,
            "submitted": (M.game.player_tracker[_winner_info[i].team]["submitted"] + 1) || 1
        })
        subtr--
    }

    // for each waifu channel
    M.channels.forEach((value) => {
        const revealEmbed = new MessageEmbed()
            .setTitle(M.text["revealTitle"])
            .setColor(M.teams[_winner_info[0].team].color)
            .setDescription(M.text["revealDescription"])
            .setThumbnail(M.teams[_winner_info[0].team].image)
            .addField("Solution", _result)
        _winner_info.forEach((el, i) => {
            revealEmbed.addField((i + 1) + ". :", `**${el.name}** from team **${el.team}**      **Score:** +${3-i}  **Total Pantsu:** ${M.teams[el.team].score}`)
        })
        _client.channels.cache.get(value.toString()).send({embeds: [revealEmbed]})
    })
    M.game.rank = []
}

function quitGame(_client) {
    let sortedScores = getSortedTeamStats()
    let mvp_1 = getBestOfTeam(M.game.player_tracker[sortedScores[0].name])
    let mvp_2 = getBestOfTeam(M.game.player_tracker[sortedScores[1].name])
    let mvp_3 = getBestOfTeam(M.game.player_tracker[sortedScores[2].name])
    M.channels.forEach((value) => {
        const goodbyeEmbed = new MessageEmbed()
            .setTitle(`Team ${sortedScores[0].name} has won!`)
            .setColor(M.game.color_theme)
            .setDescription(M.text["quitDescription"])
            .setThumbnail(M.teams[sortedScores[0].name].image)
            .addFields(
                {name: "\u200B", value: "\u200B"},
                {name: "1st:", value: "**" + sortedScores[0].name + "** with a score of **" + sortedScores[0].score + "**"},
                {name: "2nd:", value: "**" + sortedScores[1].name + "** with a score of **" + sortedScores[1].score + "**"},
                {name: "3rd:", value: "**" + sortedScores[2].name + "** with a score of **" + sortedScores[2].score + "**"},
                {name: "\u200B", value: "\u200B"},
                {name: "The MVP of the winnerteam is :", value: "**" + mvp_1[0] + "** with a score of **" + mvp_1[1] + "** and **" + mvp_1[2] + "** submitted answers!"},
                {name: "\u200B", value: "Now the MVPs of loserteams will be awarded:"},
                {name: "Of Team " + sortedScores[1].name + ":", value: "**" + mvp_2[0] + "** with a score of **" + mvp_2[1] + "** and **" + mvp_2[2] + "** submitted answers!"},
                {name: "Of Team " + sortedScores[2].name + ":", value: "**" + mvp_3[0] + "** with a score of **" + mvp_3[1] + "** and **" + mvp_3[2] + "** submitted answers!"},
                {name: "\u200B", value: "\u200B"},
                {name: "Thanks for participating!", value: "You are great :heart:"}
            )
        _client.channels.cache.get(value.toString()).send({embeds: [goodbyeEmbed]})
    })

    //clean states for team
    M.game.player_tracker = {"Azume": {}, "Saya": {}, "Zashima": {},}
    M.game.counter = 0
    M.game.is_game = false
    M.teams["Azume"].score = 0
    M.teams["Zashima"].score = 0
    M.teams["Saya"].score = 0
}

module.exports = (_client) => {
    _client.on("ready", () => {
        console.log("Waifu is ready to go!")
    })

    _client.on("messageCreate", _msg => {
        function reset() {
            M.game.rank = []
            M.game.submitted_teams = []
            M.game.can_answer = false
        }

        if (_msg.author.bot) return

        const checkChannel = (el) => el === _msg.channel.id

        if (!M.channels.some(checkChannel)) return
        let teamLowerCase = _msg.channel.name.split("-")[1]
        let teamCapitalized = teamLowerCase.charAt(0).toUpperCase() + teamLowerCase.slice(1)
        const check = (el) => el === teamCapitalized
        let command = Helpers.composeWithDash(_msg.content)

        if (command === "!waifu-start" && Helpers.auth(_msg)) {
            _msg.delete()
            M.game.is_game = true
            M.game.counter = 0
            initGame(_client, _msg, M.game.counter)
            return
        }

        // only progress when game is active
        if (!M.game.is_game) return

        if (command === "!waifu-next" && M.game.counter < M.riddles.length && Helpers.auth(_msg)) {
            _msg.delete()
            nextQuestion(_client, M.game.counter)
            setTimeout(function () {
                M.game.can_answer = true
            }, 7000)
            M.game.counter++
            return
        }

        if (command === "!waifu-end" && Helpers.auth(_msg)) {
            _msg.delete()
            quitGame(_client)
            reset()
            return
        }

        // only react on right answer and question active
        if (!M.game.can_answer) return
        // allow multiple defined answers
        if (!M.riddles[M.game.counter - 1].answer.split("/").includes(_msg.content.toLowerCase())) return
        if (M.game.submitted_teams.some(check)) return

        // fill the game.ranks
        if (M.game.rank.length < M.game.rank_amount) {
            M.game.rank.push({name: _msg.author.username, team: teamCapitalized})
            M.game.submitted_teams.push(teamCapitalized)
        }

        if (M.game.rank.length === M.game.rank_amount) {
            revealResult(_client, _msg, M.riddles[M.game.counter - 1].solution, M.game.rank)
            reset()
        } else {
            _msg.channel.send("You've submitted the right answer! wait for the others")
        }
    })
}