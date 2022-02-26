const mongoose = require("mongoose")

const schema = new mongoose.Schema({
    playerID: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: false
    }
})

module.exports = mongoose.model("kingslisted", schema)