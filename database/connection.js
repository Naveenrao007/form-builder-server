const mongoose = require('mongoose')
const dotenv = require('dotenv')
dotenv.config()
const MONGODB_URI = process.env.MONGODB_URI

const connectDb = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Database connected successfully!");

            
    } catch (error) {
        console.error("Database connection failed:", error);
        setTimeout(connectDb, 5000);
    }
};


module.exports = connectDb
