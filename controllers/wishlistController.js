
const Wishlist = require('../models/wishlistModel');
const Product = require('../models/productModel');

// Add an item to the wishlist
exports.addToWishlist = async (req, res) => {
    const { product } = req.body;
    const userId = req.user;

    try {
        const productExists = await Product.findById(product);
        if (!productExists)
            return res.status(404).json({ message: "Product not found" });

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, items: [] });
        }

        const exists = wishlist.items.some(
            (item) => item.product.toString() === product
        );

        if (exists)
            return res.status(200).json({ message: "Already in wishlist" });

        wishlist.items.push({ product });
        await wishlist.save();

        res.json(wishlist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// GET WISHLIST
exports.getWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ user: req.user }).populate(
            "items.product"
        );
        console.log('wishlist', wishlist);
        if (!wishlist)
            return res.status(404).json({ message: "Wishlist not found" });

        res.json(wishlist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update item quantity in the wishlist
exports.updateWishlistItem = async (req, res) => {
    const { productId, color, quantity } = req.body; // Get data from the request body
    const userId = req.user; // Access user ID from req.user

    try {
        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        }

        const itemIndex = wishlist.items.findIndex(item => item.product.equals(productId) && item.color === color);
        if (itemIndex > -1) {
            if (quantity < 1) {
                // If quantity is less than 1, remove the item
                wishlist.items.splice(itemIndex, 1);
            } else {
                // Update the quantity
                wishlist.items[itemIndex].quantity = quantity;
            }
        } else {
            return res.status(404).json({ message: 'Item not found in wishlist' });
        }

        await wishlist.save();
        res.status(200).json({ message: 'Wishlist updated', wishlist });
    } catch (error) {
        res.status(500).json({ message: 'Error updating wishlist', error });
    }
};


// REMOVE FROM WISHLIST
exports.removeWishlistItem = async (req, res) => {
    const { productId } = req.body;
    const userId = req.user;

    try {
        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist)
            return res.status(404).json({ message: "Wishlist not found" });

        wishlist.items = wishlist.items.filter(
            (item) => item.product.toString() !== productId
        );

        await wishlist.save();
        res.json(wishlist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
