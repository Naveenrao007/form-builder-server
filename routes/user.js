const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");
const User = require("../schema/user.schema");

const authMiddleware = require('../middleware/Auth')
const isAuth = require('../utils/index')
const { getUserIdByEmail } = require("../utils/index")



router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const isUserExists = await User.findOne({ email });
        if (isUserExists) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        return res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: "A user with this email already exists",
                keyValue: error.keyValue,
            });
        }
        return res.status(500).json({ message: "Internal Server Error" });
    }
});

// login  func
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Wrong email or password" });
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({ message: "Wrong email or password" });
        }
        const payload = { email: user.email };
        const token = jsonwebtoken.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
        return res.status(200).json({
            message: "User logged in successfully",
            token: token
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
router.get("/profile", authMiddleware, async (req, res) => {
    try {
        const userId = (await getUserIdByEmail(req.user)).toString();

        if (!userId) {
            return res.status(404).json({ error: "User not found." });
        }
        const user = await User.findById(userId);

        res.status(200).json({
            user: user,
        });
    } catch (error) {
        console.error("Error in /profle route:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});


router.post("/update", authMiddleware, async (req, res) => {
    const { name, email, gender, country } = req.body;
    const userId = (await getUserIdByEmail(req.user)).toString();
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.gender = gender || user.gender;
        user.country = country || user.country;
        const updatedUser = await user.save();
        return res.status(200).json({
            message: "User profile updated successfully.",
            user: updatedUser,
        });
    } catch (error) {
        console.error("Error updating user data:", error);
        return res.status(500).json({ message: "Internal server error" });
    }

})

module.exports = router;





