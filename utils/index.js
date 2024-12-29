
const User = require("../schema/user.schema");

const isAuth = ((req) => {
  const token = req.headers.authorization
  if (!token) return false
  try {
    return true
  } catch (err) {
    return false
  }
})




async function getUserIdByEmail(email) {
  try {
    const user = await User.findOne({ email });
    if (user) {
      return user._id;
    } else {
      throw new Error("User not found");
    }
  } catch (error) {
    console.error("Error fetching user ID:", error);
    throw error;
  }
}



module.exports = { isAuth, getUserIdByEmail }
