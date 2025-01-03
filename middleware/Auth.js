const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
dotenv.config()
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization;
    

    if (!token) {
        return res.status(400).json({ message: "User not logged In" })

    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded.email;
        next()
    } catch (error) {
        res.status(400).json({ message: "Invalid Token" })
    }
}

module.exports = authMiddleware