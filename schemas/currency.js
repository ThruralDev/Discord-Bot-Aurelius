const mongoose = require("mongoose")

const schema = new mongoose.Schema({
    playerID: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: false
    },
    balance: {
        type: Number,
        required: true
    },
    time_stamp: {
        type: String,
        required: false
    },
})

module.exports = mongoose.model("accountsUser", schema)