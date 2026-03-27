const express = require('express');
const { signup, login, activateUser, updateUserRole, getSingleUser, logout, registerOrLogin, adminLogin, getAllUsers, updateUser, getDashboardStats, updatePassword, forgotPassword, resetPassword, deactivateAccount } = require('../controllers/authController');
const { isAuthenticated, authorizeRoles } = require('../middlewares/authMiddleware');
const router = express.Router();

// Signup route
router.post('/signup', signup);

// Update User Role Route
router.put('/updateUserRole', isAuthenticated, authorizeRoles('admin'), updateUserRole);

// Activate User route
router.post('/activate', activateUser);

// Login route
router.post('/login', login);

// admin Login
router.post('/adminLogin', adminLogin);

// Logout route
router.post('/logout', logout);

// Get Single User route
router.post('/getSingleUser', isAuthenticated, getSingleUser);

// Update Password route
router.put('/updatePassword', isAuthenticated, updatePassword);

//Google login/signup api
router.post('/registerOrLogin', registerOrLogin);

// getAllUser's API
router.get('/getAllUsers', isAuthenticated, authorizeRoles('admin'), getAllUsers);

// UPDATE API
router.put('/updateUser/:id', isAuthenticated, authorizeRoles('admin'), updateUser);

// getDashboardStats API
router.get('/getDashboardStats', isAuthenticated, authorizeRoles('admin'), getDashboardStats);

// Forgot Password & Reset Password
router.post('/password/forgot', forgotPassword);
router.put('/password/reset/:token', resetPassword);

// Deactivate Account
router.put('/deactivate', isAuthenticated, deactivateAccount);

module.exports = router;
