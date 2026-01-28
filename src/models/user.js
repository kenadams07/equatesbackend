/* User model definition for authentication and profile data. */
const mongoose = require("mongoose");

// Core user schema used by auth flows
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxLength: 100,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      maxLength: 100,
      index: true, // Index added here
    },
    email: {
      type: String,
      maxLength: 100,
    },
    companyName: {
      type: String,
      maxLength: 100,
    },
    groupName: {
      type: String,
      maxLength: 100,
    },
    password: {
      type: String,
      required: true,
      maxLength: 100,
    },
    mobileNo: {
      type: Number,
      maxLength: 15,
    },
    emailVerify: {
      type: "date",
      default: null,
      Comment: { date: "verified", null: "not verified" },
    },
    ip_address: {
      system_ip: {
        type: String,
        default: null,
      },
      browser_ip: {
        type: String,
        default: null,
      },
    },
    last_login: {
      type: Date,
    },
    token: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    status: {
      type: String,
      default: "0",
      enum: ["0", "1", "2"], //0-inactive, 1- active, 2- deleted
    },
  },
  { timestamps: { createDate: "createdAt", updatedDate: "updated_at" } }
);
// User

const User = mongoose.model("User", userSchema);

module.exports = {
  User
};
