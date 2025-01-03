const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
})
const directorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['file', 'folder'],
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Directory", default: null },
    content: { type: String, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sharedWith: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            permission: { type: String, enum: ['edit', 'view'], required: true },
        },
    ],
});
const User = mongoose.model('User', userSchema)
const Directory = mongoose.model('Directory', directorySchema)
module.exports = { Directory, User };