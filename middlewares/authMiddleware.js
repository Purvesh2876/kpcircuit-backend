const jwt = require('jsonwebtoken');
const User = require('../models/userModel'); // Assuming you have the User model

// Middleware to verify if the user is authenticated
exports.isAuthenticated = async (req, res, next) => {

  let token = req.cookies.token; // Adjust this based on how you name your cookie

  // If no token is found, return an error response
  if (!token) {
    return res.status(401).json({ message: 'Login first to access this resource' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: decoded.id }; // Set the user ID on the request object

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Middleware to authorize roles
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role (${req.user.role}) is not authorized to access this resource`
      });
    }
    next();
  };
};
