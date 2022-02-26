const fs = require("fs")
let rawDataGeneral = fs.readFileSync("config.json")
let parsedDataGeneral = JSON.parse(rawDataGeneral)

const authManager = {
    admins: parsedDataGeneral.admins
}

/**
 * Takes an array and shuffle all its elements.
 * @author Thrural | Eyes Of Ignolia
 * @param _arr Array as an Input
 * @returns randomly sorted array
 **/
function shuffleArray(_arr) {
    for (let i = _arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_arr[i], _arr[j]] = [_arr[j], _arr[i]]
    }
    return _arr
}

/**
 * Proof if function can get executed by the caller. Only notified ids can do that (admin functions)
 * @author Thrural | Eyes Of Ignolia
 * @param _msg data of the message to determine caller's id.
 **/
function getRandomColor() {
    let randomizedArr = ["#"]
    for (let i = 0; i < 3; i++) {
        let randHex = Math.floor(Math.random() * 256).toString(16)
        if (randHex.length < 2) {
            randHex = "0" + randHex
        }
        randomizedArr.push(randHex)
    }
    return randomizedArr.join("")
}

/**
 * Proof if function can get executed by the caller. Only notified ids can do that (admin functions)
 * @author Thrural | Eyes Of Ignolia
 * @param _msg data of the message to determine caller's id.
 **/
function auth(_msg) {
    const check = (el) => el === _msg.author.id
    return authManager.admins.some(check)
}

/**
 * Split up the bot command and stick the pieces together with a dash. So it can be used clever to proof input.
 * @author Thrural | Eyes Of Ignolia
 * @param _x Input to split up at the whitespaces within it.
 **/
function composeWithDash(_x) {
    return _x.split(/\s{1,3}/m).join("-")
}

function checkIfNumber(data) {
    return Number.isInteger(parseInt(data))
}

module.exports = {getRandomColor, auth, composeWithDash, shuffleArray, checkIfNumber}