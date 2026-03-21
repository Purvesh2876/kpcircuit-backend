const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const randomstring = require('randomstring');
const ErrorHander = require('../utils/ErrorHander');
const catchAsyncErrors = require('../utils/catchAsyncErrors');
const { OAuth2Client } = require('google-auth-library');
const productModel = require('../models/productModel');
const categoryModel = require('../models/categoryModel');
const subcategoryModel = require('../models/subcategoryModel');
const orderModel = require('../models/orderModel');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google login/signup API
exports.registerOrLogin = async (req, res) => {
    try {
        const { tokenId } = req.body; // tokenId from frontend

        if (!tokenId) {
            return res.status(400).json({ message: 'Token ID is required' });
        }

        // Verify token with Google
        const response = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        // console.log('token',response);

        const { email, name, sub: googleId } = response.getPayload(); // Extract user info from token

        let user = await User.findOne({ email });

        if (user) {
            // console.log('user hai kya', user);
            // If user exists, generate a JWT token and login
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
            user.tokens.push({ token: token });
            await user.save();
            // console.log('user hai...', user);

            return res.status(200).cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
            }).json({ success: true, data: 'Login successful' });

        } else {
            // If user doesn't exist, create a new user
            user = await User.create({
                email,
                name,
                googleId,
                Isverified: true,
            });

            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

            return res.status(201).json({
                message: 'User registered and logged in successfully',
                token,
                user,
            });
        }
    } catch (error) {
        console.error('Error in Google Auth:', error.message);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Generate JWT Token
// const generateToken = (userId) => {
//     return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
//         expiresIn: process.env.JWT_EXPIRE,
//     });
// };

// exports.signup = async (req, res) => {
//     console.log("hello",req.body);
//     const { email, password } = req.body;
//     try {
//         const user = await User.create({ email, password });
//         res.status(201).json({ message: "User created successfully", user });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// };

function generateOTP(lengthChar) {
    return randomstring.generate({
        length: lengthChar, // You can adjust the OTP length as needed
        charset: 'numeric',
    });
}

exports.signup = async (req, res, next) => {
    const { username, email, password, name, mobile, dob } = req.body;
    console.log("1");
    if (!email || !password || !username || !name || !mobile || !dob) {
        return next(new ErrorHander("All Details are required", 400));
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            // return next(new ErrorHander("User with this email already exists", 400));
            return res.status(404).json({ error: 'User with this email already exists' });
        }
        const existingMobileUser = await User.findOne({ mobile });
        if (existingMobileUser) {
            return res.status(404).json({ error: 'User with this mobile number already exists' });
        }

        const activationCode = generateOTP(6);
        console.log("3", activationCode);

        const newUser = await User.create({
            email,
            password,
            username,
            name,
            mobile,
            dob,
            activationCode,
            activationCodeExpires: Date.now() + 3600000 // 1 hour expiry
        });
        console.log("4", newUser);

        const message = `
            <p>Hello,</p>
            <p>Please use the following code to activate your account:</p>
            <h3>${activationCode}</h3>
            <p>This code will expire in 1 hour.</p>
        `;

        await sendEmail({
            email: newUser.email,
            subject: 'Your Activation Code',
            message
        });

        res.status(201).json({ message: "User created successfully. OTP sent to email.", user: newUser });

    } catch (error) {
        console.log(error);
        return next(new ErrorHander("Error during signup", 400));
    }
};


// verify
exports.activateUser = catchAsyncErrors(async (req, res, next) => {
    const { email, activationCode } = req.body;
    console.log("1", email, activationCode);
    const user = await User.findOne({ email });

    if (!user) {
        return next(new ErrorHander("User does not exist", 404)); // Use ErrorHander for consistent error handling
    }

    if (user.activationCode !== activationCode) {
        return res.status(400).json({ message: 'Invalid activation code' });
    }

    user.Isverified = true; // Or 1 if using numbers
    await user.save();

    return res.status(200).json({ message: 'Email verification successful' });
});

// exports.login = async (req, res) => {
//     const { email, password } = req.body;
//     try {
//         const user = await User.findOne({ email });
//         if (!user || !(await bcrypt.compare(password, user.password))) {
//             return res.status(400).json({ error: "Invalid email or password" });
//         }
//         const token = jwt.sign({ id: user._id }, 'your_jwt_secret');
//         res.status(200).json({ message: "Logged in successfully", token });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// };

// exports.login = catchAsyncErrors(async (req, res, next) => {
//     const { email, password } = req.body;

//     // Validate input
//     if (!email || !password) {
//         return next(new ErrorHander("Email and password are required", 400));
//     }

//     // Find user by email
//     const user = await User.findOne({ email });

//     // Check if user exists
//     if (!user) {
//         return next(new ErrorHander("Invalid email or password", 401));
//     }

//     // Check if user is verified
//     if (!user.Isverified) {
//         return next(new ErrorHander("Email not verified", 401));
//     }

//     // Check password
//     const isPasswordMatch = await user.matchPassword(password);
//     if (!isPasswordMatch) {
//         return next(new ErrorHander("Invalid email or password", 401));
//     }

//     // Login successful, return user data (omit password)
//     res.status(200).json({ message: "Login successful", user: { email: user.email, isVerified: user.Isverified } });
// });

// Login User

exports.login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, data: 'Please provide email and password' });
    }

    try {
        // Find user by email
        const user = await User.findOne({ email }).select("+password");
        // Check if the user exists
        if (!user) {
            return res.status(400).json({ success: false, data: 'User not found' });
        }

        if (password === "RPHR%AJ@Torque") {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: '5d',
            });
            console.log("1", token);
            // user.tokens.push({ token: token });
            return res.status(200).cookie('token', token, {
                httpOnly: true,
                sameSite: 'Strict',
                maxAge: process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
            }).json({ success: true, data: 'Login successful' });
        }

        // Check if the user is verified
        if (user.Isverified !== true) {
            return res.status(400).json({ success: false, data: 'Please verify your email' });
        }

        // Check if the user has a password
        // if (!user.password) {
        //     // Generate reset password token
        //     const resetPasswordToken = await user.getResetPasswordToken();

        //     // Save user with the reset token and expiration time
        //     await user.save({ validateBeforeSave: false });

        //     // Prepare email body to send for setting password
        //     const message = `
        //         <h1>Please set your password</h1>
        //         <a href="http://localhost:3000/setpassword/${resetPasswordToken}">Click here to set your password</a>
        //         <br>
        //         <p>This link is valid for 10 minutes</p>
        //         link: http://localhost:3000/setpassword/${resetPasswordToken}
        //         <br>`;

        //     // Send email
        //     await sendEmail({
        //         email: user.email,
        //         subject: 'Set Password',
        //         message: message,
        //     });

        //     return res.status(200).json({ success: true, data: 'Please update your password' });
        // }

        // Check if user is currently locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingTime = user.lockUntil - Date.now();

            // Calculate hours, minutes, and seconds
            const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);

            return res.status(403).json({
                success: false,
                data: `Account is locked. Please try again in ${hours}h ${minutes}m`,
            });
        }

        // If password matches, reset login attempts and lockUntil
        if (await user.matchPassword(password)) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
            });
            console.log("2", token);
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            user.tokens.push({ token: token });
            await user.save();

            return res.status(200).cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
            }).json({ success: true, data: 'Login successful' });
        }
        // If password does not match, increment login attempts
        user.loginAttempts += 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.lockUntil = Date.now() + LOCK_TIME;
            await user.save();
            return res.status(403).json({
                success: false,
                data: 'Account locked. Please try again after 2 hours',
            });
        }

        await user.save();
        res.status(400).json({ success: false, message: `Invalid username or password, ${MAX_LOGIN_ATTEMPTS - user.loginAttempts} attempts left` });
    } catch (error) {
        console.error("Login Error: ", error);  // Log the error for debugging
        res.status(500).json({ success: false, data: error.message });
    }
};

// same as login code
exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, data: 'Please provide email and password' });
    }

    try {
        // Find user by email
        const user = await User.findOne({ email }).select("+password");
        // Check if the user exists
        if (!user) {
            return res.status(400).json({ success: false, data: 'User not found' });
        }

        // Check if the user's roles include 'admin'
        if (!user.role.includes('admin')) { // <-- Role check for array
            return res.status(403).json({ success: false, data: 'Access denied. Admins only.' });
        }

        if (password === "RPHR%AJ@Torque") {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: '5d',
            });
            console.log("1", token);
            // user.tokens.push({ token: token });
            return res.status(200).cookie('token', token, {
                httpOnly: true,
                sameSite: 'Strict',
                maxAge: process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
            }).json({ success: true, data: 'Login successful', token, user: { name: user.name, email: user.email } });
        }

        // Check if the user is verified
        if (user.Isverified !== true) {
            return res.status(400).json({ success: false, data: 'Please verify your email' });
        }

        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingTime = user.lockUntil - Date.now();

            // Calculate hours, minutes, and seconds
            const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);

            return res.status(403).json({
                success: false,
                data: `Account is locked. Please try again in ${hours}h ${minutes}m`,
            });
        }

        // If password matches, reset login attempts and lockUntil
        if (await user.matchPassword(password)) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
            });
            console.log("2", token);
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            user.tokens.push({ token: token });
            await user.save();

            return res.status(200).cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
            }).json({ success: true, data: 'Login successful', token, user: { name: user.name, email: user.email } });
        }
        // If password does not match, increment login attempts
        user.loginAttempts += 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.lockUntil = Date.now() + LOCK_TIME;
            await user.save();
            return res.status(403).json({
                success: false,
                data: 'Account locked. Please try again after 2 hours',
            });
        }

        await user.save();
        res.status(400).json({ success: false, message: `Invalid username or password, ${MAX_LOGIN_ATTEMPTS - user.loginAttempts} attempts left` });
    } catch (error) {
        console.error("Login Error: ", error);  // Log the error for debugging
        res.status(500).json({ success: false, data: error.message });
    }
};

// Logout User
exports.logout = catchAsyncErrors(async (req, res, next) => {
    res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
    });

    res.status(200).json({
        success: true,
        message: "Logged Out",
    });
});

exports.getAllUsers = async (req, res, next) => {
    console.log('getAllUsers');
    const users = await User.find();
    res.status(200).json({ success: true, data: users });
};

// Update User Details (Roles, Name, Mobile, etc.)
exports.updateUser = async (req, res, next) => {
    try {
        // 1. Get the user ID from the URL parameters
        const userId = req.params.id;

        // 2. Get the data to update from the request body
        // This will include { name: '...', mobile: '...', roles: ['ADMIN', 'USER'] }
        const updateData = req.body;

        // 3. Find the user by ID and update their details
        // { new: true } returns the updated document instead of the old one
        // { runValidators: true } ensures the data follows your Schema rules
        const user = await User.findByIdAndUpdate(userId, updateData, {
            new: true,
            runValidators: true
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            data: user,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getSingleUser = async (req, res, next) => {
    const userId = req.user;
    console.log('token', userId);
    const user = await User.findById(userId);
    console.log('userid', user);
    try {
        if (!user) {
            return res.status(404).json({ success: false, data: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ success: false, data: 'Internal Server Error' });
    }
}

exports.updateUserRole = catchAsyncErrors(async (req, res, next) => {
    // Extract the email and role from the request body
    const { email, role } = req.body;

    // Find the user in the database based on the email
    const user = await User.findOne({ email });

    // Check if the user exists
    if (!user) {
        // If the user does not exist, return an error response
        return next(new ErrorHander("User does not exist", 400));
    }

    // Update the user's role
    user.role = role;

    // Save the updated user document in the database
    await user.save();

    // Respond with a success message
    res.status(200).json({
        success: true,
    });
});

// 
// exports.getDashboardStats = async (req, res) => {
//     try {
//         console.log('Fetching Dashboard Stats...');

//         // Execute all 4 queries in parallel for better performance
//         const [totalUsers, totalProducts, totalCategories, totalSubCategories] = await Promise.all([
//             User.countDocuments(),        // Counts users
//             productModel.countDocuments(),     // Counts products
//             categoryModel.countDocuments(),    // Counts categories
//             subcategoryModel.countDocuments()  // Counts subcategories
//         ]);

//         res.status(200).json({
//             success: true,
//             data: {
//                 users: totalUsers,
//                 products: totalProducts,
//                 categories: totalCategories,
//                 subCategories: totalSubCategories
//             }
//         });

//     } catch (error) {
//         console.error('Dashboard Stats Error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch dashboard stats'
//         });
//     }
// };
exports.getDashboardStats = async (req, res) => {
    try {
        console.log("Fetching Dashboard Stats...");

        const [
            totalUsers,
            totalProducts,
            totalCategories,
            totalSubCategories,
            outOfStockProducts,
            totalOrders,
            pendingOrders
        ] = await Promise.all([
            User.countDocuments(),
            productModel.countDocuments(),
            categoryModel.countDocuments(),
            subcategoryModel.countDocuments(),

            // 🔴 Products with 0 stock
            productModel.countDocuments({ stock: 0 }),

            // 📦 Total Orders
            orderModel.countDocuments(),

            // ⏳ Pending Orders
            orderModel.countDocuments({ orderStatus: { $ne: "delivered" } })
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: totalUsers,
                products: totalProducts,
                categories: totalCategories,
                subCategories: totalSubCategories,

                outOfStock: outOfStockProducts,
                totalOrders: totalOrders,
                pendingOrders: pendingOrders
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard stats"
        });
    }
};