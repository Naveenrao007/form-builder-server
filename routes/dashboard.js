const express = require("express");
const router = express.Router();
const jsonwebtoken = require("jsonwebtoken");

const { getUserIdByEmail } = require("../utils/index");
const { User, Directory } = require("../schema/user.schema");

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
      return res.status(400).json({
        message: "A file or folder with this name already exists at this level.",
      });
    }


    const newDirectory = new Directory({
      name,
      type,
      parent: parent || null,
      content: type === "file" ? content || "" : null,
      owner: userId,
    });


    if (parent) {
      const parentDirectory = await Directory.findOne({ _id: parent });
      if (parentDirectory) {
        newDirectory.sharedWith = parentDirectory.sharedWith;
      }
    }

    await newDirectory.save();


    const allOwnedDirs = await Directory.find({ owner: userId });


    const shareNewDirectoryWithUsers = async () => {
      for (const dir of allOwnedDirs) {
        for (const shared of dir.sharedWith) {
          if (!newDirectory.sharedWith.some((user) => user.user.toString() === shared.user.toString())) {
            newDirectory.sharedWith.push(shared);
          }
        }
      }
      await newDirectory.save();
    };

    await shareNewDirectoryWithUsers();

    res.status(201).json({ message: "Successfully created", data: newDirectory });
  } catch (err) {
    console.error("Error creating directory:", err);
    res.status(500).json({ message: "Server error" });
  }
});



router.get("/alldirs", authMiddleware, async (req, res) => {
  const userEmail = req.user;

  if (!userEmail) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const ownedDirectories = await Directory.find({ owner: user._id }).populate("owner", "name email");

    const sharedDirectories = await Directory.find({
      "sharedWith.user": user._id,
    })
      .populate("owner", "name email")
      .populate("sharedWith.user", "name email");

    const sharedByUsers = sharedDirectories.reduce((acc, directory) => {
      directory.sharedWith.forEach((sharedEntry) => {
        if (sharedEntry?.user) {
          const userId = sharedEntry.user._id.toString();
          const permission = sharedEntry.permission;

          if (!acc[userId]) {
            acc[userId] = {
              user: {
                id: userId,
                name: sharedEntry.user.name,
                email: sharedEntry.user.email,
              },
              directories: [],
            };
          }

          acc[userId].directories.push({
            id: directory._id,
            name: directory.name,
            type: directory.type,
            parent: directory.parent,
            content: directory.content,
            owner: {
              id: directory.owner._id,
              name: directory.owner.name,
              email: directory.owner.email,
            },
            permission,
          });
        }
      });

      return acc;
    }, {});

    res.status(200).json({
      message: "Directories fetched successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        ownedDirectories,
        sharedByUsers: Object.values(sharedByUsers),
      },
    });
  } catch (err) {
    console.error("Error fetching directories:", err);
    res.status(500).json({ message: "Server error" });
  }
});



router.delete("/deletedir", authMiddleware, async (req, res) => {
  const userEmail = req.user;
  const { type, id } = req.body;


  try {
    if (!type || !id) {
      return res.status(400).json({ message: "type and id are required." });
    }

    const user = await User.findOne({ email: userEmail });


    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }




    const directoryById = await Directory.findById(id);
    if (!directoryById) {
      return res.status(404).json({ message: "Directory not found." });
    }


    if (!directoryById.owner.equals(user._id)) {
      return res.status(403).json({ message: "Access denied. You are not the owner of this directory." });
    }




    if (directoryById.type.trim().toLowerCase() !== type.trim().toLowerCase()) {
      return res
        .status(400)
        .json({ message: `Invalid type. Expected ${directoryById.type}.` });
    }


    await Directory.findByIdAndDelete(id);

    res.status(200).json({
      message: `${type} deleted successfully.`,
      data: { id }
    });
  } catch (err) {
    console.error("Error deleting directory:", err);
    res.status(500).json({ message: "Server error." });
  }
});
router.post("/sharedirectory", authMiddleware, async (req, res) => {
  const { email, permission } = req.body;
  const userEmail = req.user;

  if (!email || !permission || !['edit', 'view'].includes(permission)) {
    return res.status(400).json({ message: "Email and valid permission are required" });
  }

  try {
    const userId = await getUserIdByEmail(userEmail);


    const directory = await Directory.findOne({ owner: userId });
    if (!directory) {
      return res.status(404).json({ message: "Directory is Empty" });
    }


    const userToShare = await User.findOne({ email });
    if (!userToShare) {
      return res.status(404).json({ message: "User with this email does not exist" });
    }


    const isAlreadyShared = directory.sharedWith.some(
      (shared) => shared.user.toString() === userToShare._id.toString()
    );

    if (!isAlreadyShared) {
      directory.sharedWith.push({ user: userToShare._id, permission });
      await directory.save();
    }


    const shareSubdirectoriesAndSiblings = async (dirId) => {
      const subdirectories = await Directory.find({ parent: dirId });


      for (const subdir of subdirectories) {
        const isSubdirAlreadyShared = subdir.sharedWith.some(
          (shared) => shared.user.toString() === userToShare._id.toString()
        );

        if (!isSubdirAlreadyShared) {
          subdir.sharedWith.push({ user: userToShare._id, permission });
          await subdir.save();
        }

        await shareSubdirectoriesAndSiblings(subdir._id);
      }


      const siblings = await Directory.find({ parent: directory.parent, owner: userId });

      for (const sibling of siblings) {
        const isSiblingAlreadyShared = sibling.sharedWith.some(
          (shared) => shared.user.toString() === userToShare._id.toString()
        );

        if (!isSiblingAlreadyShared) {
          sibling.sharedWith.push({ user: userToShare._id, permission });
          await sibling.save();
        }
      }
    };


    await shareSubdirectoriesAndSiblings(directory._id);


    const allOwnedDirs = await Directory.find({ owner: userId });
    for (const dir of allOwnedDirs) {
      const isAlreadySharedWithUser = dir.sharedWith.some(
        (shared) => shared.user.toString() === userToShare._id.toString()
      );
      if (!isAlreadySharedWithUser) {
        dir.sharedWith.push({ user: userToShare._id, permission });
        await dir.save();
      }
    }

    res.status(200).json({ message: "Directory and subdirectories shared successfully" });
  } catch (error) {
    console.error("Error sharing directory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/sharedirectorybyurl", authMiddleware, async (req, res) => {
  const { token, permission } = req.body;
  const loggedInUserEmail = req.user;

  if (!token || !permission || !['edit', 'view'].includes(permission)) {
    return res.status(400).json({ message: "Token and valid permission are required" });
  }

  try {
    const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);
    const linkCreatorUserId = decoded.userId;

    if (!linkCreatorUserId) {
      return res.status(401).json({ message: "Invalid token or userId not found in token" });
    }

    // Find the directory that the user is sharing
    const directory = await Directory.findOne({ owner: linkCreatorUserId });
    if (!directory) {
      return res.status(404).json({ message: "Directory is Empty" });
    }

    // Get the logged-in user ID
    const loggedInUserId = await getUserIdByEmail(loggedInUserEmail);

    // Updated function to avoid duplicates and add permissions for the user who is accessing the link (User 2)
    const updateSharedWith = (sharedWithArray, userId, permission) => {
      const existingUserIndex = sharedWithArray.findIndex(
        (shared) => shared.user.toString() === userId.toString()
      );

      if (existingUserIndex === -1) {
        // If user does not exist, add them to the sharedWith array
        sharedWithArray.push({ user: userId, permission });
      } else {
        // If user exists, update their permission only if it's different
        if (sharedWithArray[existingUserIndex].permission !== permission) {
          sharedWithArray[existingUserIndex].permission = permission;
        }
      }
    };

    // Update the sharedWith field for the directory
    updateSharedWith(directory.sharedWith, loggedInUserId, permission);
    await directory.save();

    // Recursive function to update permissions for subdirectories and sibling directories
    const shareSubdirectoriesAndSiblings = async (dirId) => {
      const subdirectories = await Directory.find({ parent: dirId });

      for (const subdir of subdirectories) {
        updateSharedWith(subdir.sharedWith, loggedInUserId, permission);
        await subdir.save();
        await shareSubdirectoriesAndSiblings(subdir._id); 
      }

      const siblings = await Directory.find({ parent: directory.parent, owner: linkCreatorUserId });

      for (const sibling of siblings) {
        updateSharedWith(sibling.sharedWith, loggedInUserId, permission);
        await sibling.save();
      }
    };

    await shareSubdirectoriesAndSiblings(directory._id);

    res.status(200).json({ message: "Directory and subdirectories shared successfully" });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    console.error("Error sharing directory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



router.post("/generatesharelink", authMiddleware, async (req, res) => {
  const { permission } = req.body;

  if (!permission || !['view', 'edit'].includes(permission)) {
    return res.status(400).json({ message: "Valid permission (view/edit) is required" });
  }

  const userEmail = req.user;

  try {
    const user = await User.findOne({ email: userEmail });
    const userId = await getUserIdByEmail(userEmail);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    const token = jsonwebtoken.sign({ userId: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const shareLink = `http://localhost:5173/sharedirectory?token=${token}&permission=${permission}`;

    res.status(200).json({ shareLink });
  } catch (err) {
    console.error("Error generating share link:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
