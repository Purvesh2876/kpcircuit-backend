// productController.js
const Category = require('../models/categoryModel');
const Product = require('../models/productModel');
const fs = require('fs');
const path = require('path');
const subcategoryModel = require('../models/subcategoryModel');

// Create a new product
// exports.createProduct = async (req, res) => {
//     try {
//         const { name, category, description, variants, tags, featured } = req.body;
//         console.log('get data from frontend', name, category, description, variants, featured);
//         // Check if the category exists
//         const categoryExists = await Category.findById(category);
//         if (!categoryExists) {
//             return res.status(404).json({ message: 'Category not found' });
//         }

//         const directoryPath = path.join(__dirname, '../category', name);
//         if (!fs.existsSync(directoryPath)) {
//             fs.mkdirSync(directoryPath, { recursive: true });
//         }

//         // const { category } = req.body;
//         // if (!category || !mongoose.Types.ObjectId.isValid(category)) {
//         //     return res.status(400).json({ message: 'Invalid Category ID' });
//         // }


//         // Map the uploaded files to their paths
//         // const imagesPath = req.files.map(file => `/products/${name}/${file.filename}`); // Use the same structure as in category
//         let parsedTags;
//         try {
//             parsedTags = JSON.parse(tags); // Parse the tags if they are sent as a JSON string
//             if (!Array.isArray(parsedTags)) {
//                 throw new Error('Tags must be an array');
//             }
//         } catch (error) {
//             return res.status(400).json({ message: `Invalid tags format: ${error.message}` });
//         }

//         let imagesPath = [];
//         if (req.files && req.files.length > 0) {
//             imagesPath = req.files.map(file => `/products/${name}/${file.filename}`);
//         }

//         // Create the new product with images
//         const newProduct = new Product({
//             name,
//             category,
//             description,
//             tags: parsedTags,
//             images: imagesPath, // Save the image paths
//             variants: JSON.parse(variants), // Assuming variants are sent as a JSON string
//             featured: featured === 'true' // Convert to boolean
//         });

//         console.log('newProduct', newProduct);

//         await newProduct.save();
//         res.status(201).json(newProduct);
//     } catch (error) {
//         console.error(error);
//         res.status(400).json({ message: error.message });
//     }
// };

const { generateSKU } = require("../utils/skuGenerator");

exports.createProduct = async (req, res) => {
    try {
        const {
            name,
            category,
            subCategory,
            description,
            manufacturer,
            price,
            stock,
            featured,
        } = req.body;

        const cat = await Category.findById(category);
        const sub = await subcategoryModel.findById(subCategory);

        if (!cat || !sub) {
            return res.status(400).json({ message: "Invalid category or subcategory" });
        }

        const sku = await generateSKU(cat.name, sub.name);

        const imagesPath = req.files
            ? req.files.map(file => `/products/${name}/${file.filename}`)
            : [];

        const product = await Product.create({
            name,
            sku,
            category,
            subCategory,
            description,
            manufacturer,
            price,
            stock,
            images: imagesPath,
            featured,
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// exports.getAllProducts = async (req, res) => {
//     try {
//         const {
//             category,
//             subCategory,
//             search,
//             sort = "newest",
//             page = 1,
//             limit = 10,
//         } = req.query;

//         let filter = { isActive: true };

//         // Category filter
//         if (category) {
//             filter.category = category;
//         }

//         // SubCategory filter
//         if (subCategory) {
//             filter.subCategory = subCategory;
//         }

//         // Search (global or contextual)
//         if (search) {
//             filter.$or = [
//                 { name: new RegExp(search, "i") },
//                 { manufacturer: new RegExp(search, "i") },
//             ];
//         }

//         // Sorting
//         let sortQuery = { createdAt: -1 }; // newest default

//         if (sort === "price_asc") sortQuery = { price: 1 };
//         if (sort === "price_desc") sortQuery = { price: -1 };

//         const skip = (page - 1) * limit;

//         const products = await Product.find(filter)
//             .populate("category", "name")
//             .populate("subCategory", "name")
//             .sort(sortQuery)
//             .skip(skip)
//             .limit(Number(limit));

//         const totalProducts = await Product.countDocuments(filter);

//         res.status(200).json({
//             totalProducts,
//             currentPage: Number(page),
//             totalPages: Math.ceil(totalProducts / limit),
//             products,
//         });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };

exports.getAllProducts = async (req, res) => {
    try {
        const {
            category,
            subCategory,
            search,
            sort = "newest",
            page = 1,
            minPrice,
            maxPrice,
            featured
        } = req.query;

        // ✅ Only default to 10 if limit is NOT provided
        const limitValue = req.query.limit ? Number(req.query.limit) : 10;

        // Safety: prevent invalid values
        const safeLimit = limitValue > 0 ? limitValue : 10;

        let filter = { isActive: true };

        if (category) filter.category = category;
        if (subCategory) filter.subCategory = subCategory;

        if (search) {
            filter.$or = [
                { name: new RegExp(search, "i") },
                { manufacturer: new RegExp(search, "i") },
            ];
        }

        // 🔥 PRICE FILTER
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        // 🔥 FEATURED FILTER
        if (featured === "true") {
            filter.featured = true;
        }

        let sortQuery = { createdAt: -1 };
        if (sort === "price_asc") sortQuery = { price: 1 };
        if (sort === "price_desc") sortQuery = { price: -1 };

        const skip = (Number(page) - 1) * safeLimit;

        const products = await Product.find(filter)
            .populate("category", "name")
            .populate("subCategory", "name")
            .sort(sortQuery)
            .skip(skip)
            .limit(safeLimit);

        const totalProducts = await Product.countDocuments(filter);

        res.status(200).json({
            totalProducts,
            currentPage: Number(page),
            totalPages: Math.ceil(totalProducts / safeLimit),
            products,
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        console.log('q', q);
        if (!q || q.trim().length < 2) {
            return res.status(200).json({ products: [] });
        }

        const products = await Product.find({
            isActive: true,
            name: { $regex: q, $options: "i" }, // ✅ only name
        })
            .select("_id name price mainImage")
            .limit(4); // only 4
        console.log('products', products);
        res.status(200).json({ products });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET SINGLE PRODUCT
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate("category", "name")
            .populate("subCategory", "name");

        console.log('product', product);
        if (!product)
            return res.status(404).json({ message: "Product not found" });

        res.json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { name, category, description, tags, variants, existingImages, removedImages, featured, subCategory, manufacturer, price, stock } = req.body;

        // Check if the category exists
        if (category) {
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(404).json({ message: 'Category not found' });
            }
        }

        // Parse arrays from JSON strings if necessary
        const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        const parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
        const parsedExistingImages = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
        const parsedRemovedImages = typeof removedImages === 'string' ? JSON.parse(removedImages) : removedImages;

        // Prepare the update data
        const updateData = {
            name,
            category,
            subCategory,
            manufacturer,
            price,
            stock,
            description,
            tags: parsedTags,
            variants: parsedVariants,
            featured: featured === 'true',
        };

        // Retrieve existing product images
        const existingProduct = await Product.findById(req.params.id);
        if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

        // Remove specified images if any
        if (parsedRemovedImages && parsedRemovedImages.length > 0) {
            updateData.images = existingProduct.images.filter(image => !parsedRemovedImages.includes(image));

            // Delete removed images from the backend folder
            parsedRemovedImages.forEach((image) => {
                const imagePath = path.join(__dirname, '../uploads', image); // Update this path
                console.log(`Checking image: ${imagePath}`);
                fs.access(imagePath, fs.constants.F_OK, (err) => {
                    if (!err) {
                        fs.unlink(imagePath, (unlinkErr) => {
                            if (unlinkErr) console.error(`Error deleting image: ${unlinkErr.message}`);
                        });
                    } else {
                        console.error(`Image not found: ${imagePath}`);
                    }
                });
            });
        } else {
            updateData.images = parsedExistingImages || existingProduct.images;
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            const newImagesPath = req.files.map(file => `/products/${name}/${file.filename}`);
            updateData.images = [...updateData.images, ...newImagesPath];
        }

        // Update the product in the database
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};


// Delete a product
exports.deleteProduct = async (req, res) => {
    try {
        console.log('req.params.id', req.params.id);
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

