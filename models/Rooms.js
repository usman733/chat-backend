const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
});

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;