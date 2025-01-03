const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");
const {User} = require("../schema/user.schema")
const authMiddleware = require('../middleware/Auth')
const {isAuth} = require('../utils/index')
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
            return res.status(400).json({ message: "User not found" });
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



router.post("/update", authMiddleware, async (req, res) => {
    const { name, email, oldPassword, newPassword } = req.body;
    const createdByUserId = (await getUserIdByEmail(req.user)).toString();
    try {
        const user = await User.findById(createdByUserId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (name && name !== "") {
            user.name = name;
            await user.save();
            return res.status(201).json({ user, message: "Name updated successfully." });
        }

        if (email && email !== "") {
            user.email = email;
            await user.save();
            return res.status(201).json({ message: "Email updated successfully." });
        }

        if (oldPassword && newPassword) {
            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Old password is incorrect." });
            }
            if (oldPassword === newPassword) {
                return res.status(400).json({ message: "New password cannot be the same as the old password." });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;
            await user.save();
            return res.status(201).json({ message: "Password updated successfully." });
        }
        return res.status(400).json({ message: "No valid field provided for update." });
    } catch (error) {
        console.error("Error updating user data:", error);
        return res.status(500).json({ message: "Internal server error" });
    }

})
module.exports = router;





