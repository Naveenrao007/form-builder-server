const express = require("express");
const router = express.Router();
const { getUserIdByEmail } = require("../utils/index");
const {User, Directory } = require("../schema/user.schema");

const authMiddleware = require("../middleware/Auth");
router.post("/create", authMiddleware, async (req, res) => {
  const { name, type, parent, content } = req.body;
  const userEmail = req.user;

  try {
    const userId = await getUserIdByEmail(userEmail);
    if (!name || !type || !["file", "folder"].includes(type)) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    const existingDirectory = await Directory.findOne({
      name,
      parent: parent || null,
      owner: userId,
    });

    if (existingDirectory) {
      return res
        .status(400)
        .json({
          message:
            "A file or folder with this name already exists at this level.",
        });
    }

    const newDirectory = new Directory({
      name,
      type,
      parent: parent || null,
      content: type === "file" ? content || "" : null,
      owner: userId,
    });

    await newDirectory.save();
    const allDirectory = await Directory.find()
    res
      .status(201)
      .json({
        message: "Successfully created",
        data: allDirectory
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/alldirs", authMiddleware, async (req, res) => {
  const userEmail = req.user; // Assuming `authMiddleware` attaches the user's email to `req.user`

  try {
    
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

   
    const allDirectories = await Directory.find({ owner: user._id }).populate("owner", "name email");

    res.status(200).json({
      message: "Directories fetched successfully",
      data: {
        user, allDirectories
      }
    });
  } catch (err) {
    console.error("Error fetching directories:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

