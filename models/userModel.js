const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      // required: [true, 'Please enter your username'],
      unique: true,
      sparse: true, // Allows for some users (Google sign-in) to skip this field
    },
    mobile: {
      type: String,
      // required: [true, 'Please enter your mobile number'],
      unique: true,
      sparse: true, // Allows Google sign-in users to skip this field
    },
    name: {
      type: String,
      required: [true, 'Please enter your name'],
    },
    email: {
      type: String,
      required: [true, 'Please enter your email'],
      unique: true,
      match: [/.+@.+\..+/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      minlength: [6, 'Password should be at least 6 characters long'],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Only required for Google Sign-In users
    },
    activationCode: {
      type: String,
    },
    activationCodeExpires: {
      type: Date,
    },
    role: {
      type: Array,
      default: 'user',
    },
    tokens: [
      {
        token: {
          type: String,
        },
      },
    ],
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    Isverified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true } // Automatically create createdAt and updatedAt timestamps
);

// Pre-save hook to hash password before saving the user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next(); // If password is not modified or not provided, move to the next middleware
  }

  // Hash the password with a salt round of 10
  this.password = await bcrypt.hash(this.password, 10);
  next(); // Move to the next middleware
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // Return false if no password exists (Google Sign-In users)
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
