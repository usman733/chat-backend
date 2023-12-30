const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const User = require('./models/Users');
const Room = require('./models/Rooms');
const Message = require('./models/Messages');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect('mongodb://127.0.0.1:27017/chat', { useNewUrlParser: true, useUnifiedTopology: true });

const users = {};

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('join', async ({ username, room }) => {

        const user = await User.findOneAndUpdate({ username }, {}, { upsert: true, new: true });

        const chatRoom = await Room.findOneAndUpdate({ name: room }, {}, { upsert: true, new: true });

        socket.join(chatRoom.name);

        users[socket.id] = { username, room };

        io.to(chatRoom.name).emit('message', {
            username: 'System',
            text: `${username} has joined the room`,
        });
        const messages = await Message.find({ room: chatRoom._id })
            .sort({ timestamp: 1 })
            .limit(10);

        socket.emit('messageHistory', messages);
    });

    socket.on('privateMessage', ({ to, text }) => {
        io.to(to).emit('privateMessage', {
            from: socket.id,
            text,
        });
    });

    socket.on('typing', () => {
        const userInfo = users[socket.id];
        console.log(userInfo, 'user');
        if (userInfo) {
            const { room } = userInfo;
            io.to(room).emit('typing', userInfo);
        }
    });

    socket.on('sendMessage', async (message) => {
        const userInfo = users[socket.id];
        if (userInfo) {
            const { username, room } = userInfo;
            const usrname = await User.findOne({ username });
            const usrroom = await Room.findOne({ name: room });
            console.log(userInfo, ' user info   ', usrname);
            const newMessage = new Message({ user: usrname._id, room: usrroom._id, text: message });
            await newMessage.save();

            io.to(room).emit('message', { username, text: message });
        }
    });

    socket.on('disconnect', () => {
        const userInfo = users[socket.id];
        if (userInfo) {
            const { username, room } = userInfo;
            io.to(room).emit('message', {
                username: 'System',
                text: `${username} has left the room`,
            });
            delete users[socket.id];
        }
    });
});

app.use(cors());

app.get('/api/rooms', async (req, res, next) => {

    const rooms = await Room.aggregate(
        [
            {
                $lookup: {
                    from: "messages",
                    localField: "_id",
                    foreignField: "room",
                    as: "messages",
                },
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    messages: {
                        room: 1,
                        user: 1,
                        text: 1,
                        timestamp: 1,
                    },
                },
            },
        ]
    );
    res.status(200).send(rooms);
})

app.get('/api/users', async (req, res, next) => {
    const users = await User.find();
    res.status(200).send(users);
})

const PORT = 5000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
