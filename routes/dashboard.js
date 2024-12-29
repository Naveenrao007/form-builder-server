const express = require("express");
const router = express.Router();
const { getUserIdByEmail } = require("../utils/index");
const { Directory } = require("../schema/user.schema");

const authMiddleware = require("../middleware/Auth");
router.post("/create", authMiddleware, async (req, res) => {
  const { name, type, parent, content } = req.body;
  const userEmail = req.user;
  console.log("userrrrr", userEmail)
  const userId = await getUserIdByEmail(userEmail);
  console.log("userIddata11", userId);
  try {
    const userId = await getUserIdByEmail(userEmail);
    console.log("userIddata", userId);

    if (!name || !type || !["file", "folder"].includes(type)) {
      return res.status(400).json({ error: "Invalid input data" });
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
          error:
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

    res
      .status(201)
      .json({ message: "Successfully created", data: newDirectory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;


