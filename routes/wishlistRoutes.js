const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { addToWishlist, getWishlist, removeWishlistItem } = require('../controllers/wishlistController');

router.post('/add', isAuthenticated, addToWishlist);

router.get('/', isAuthenticated, getWishlist);

router.post('/remove', isAuthenticated, removeWishlistItem);

module.exports = router;