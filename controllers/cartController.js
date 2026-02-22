
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');

// ADD TO CART
exports.addToCart = async (req, res) => {
    const { product, quantity } = req.body;
    const userId = req.user;

    try {
        const productData = await Product.findById(product);
        if (!productData)
            return res.status(404).json({ message: "Product not found" });

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        const existingItem = cart.items.find(
            (item) => item.product.toString() === product
        );

        if (existingItem) {
            existingItem.quantity += Number(quantity);
        } else {
            cart.items.push({
                product,
                quantity: Number(quantity),
                priceAtAdd: productData.price,
            });
        }

        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET CART
exports.getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user }).populate(
            "items.product"
        );

        if (!cart)
            return res.status(404).json({ message: "Cart not found" });

        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// UPDATE CART ITEM
exports.updateCartItem = async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user;

    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart)
            return res.status(404).json({ message: "Cart not found" });

        const item = cart.items.find(
            (i) => i.product.toString() === productId
        );

        if (!item)
            return res.status(404).json({ message: "Item not found" });

        if (quantity <= 0) {
            cart.items = cart.items.filter(
                (i) => i.product.toString() !== productId
            );
        } else {
            item.quantity = quantity;
        }

        await cart.save();
        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// REMOVE FROM CART
exports.removeCartItem = async (req, res) => {
    const { productId } = req.body;
    const userId = req.user;

    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart)
            return res.status(404).json({ message: "Cart not found" });

        cart.items = cart.items.filter(
            (item) => item.product.toString() !== productId
        );

        await cart.save();
        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Calculate total amount in the cart
exports.getCartTotal = async (req, res) => {
    try {
        const userId = req.user;
        const cart = await Cart.findOne({ user: userId, status: 'active' });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        // Calculate total
        const totalAmount = cart.items.reduce((total, item) => {
            return total + item.priceAtAdd * item.quantity;
        }, 0);

        res.json({ total: totalAmount });
    } catch (error) {
        console.error('Error calculating cart total:', error);
        res.status(500).json({ error: 'Server error' });
    }
};