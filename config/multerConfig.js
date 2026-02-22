// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const category = req.body.name;
//         const categoryDirectory = `uploads/${category}`;
//         if (!fs.existsSync(categoryDirectory)) {
//             fs.mkdirSync(categoryDirectory, { recursive: true });
//         }
//         cb(null, categoryDirectory);
//     },
//     filename: (req, file, cb) => {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     },
// });

// const upload = multer({ storage: storage });

// module.exports = upload;


const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folderPath;

        if (req.baseUrl.includes('/api/categories')) {
            // Category route
            const categoryName = req.body.name; // Get the category name from the request body
            folderPath = `uploads/category/${categoryName}`; // Path for category uploads
        }
        else if (req.baseUrl.includes("/api/subcategory")) {
            const subCategoryName = req.body.name; // Get the subcategory name from the request body
            folderPath = `uploads/subcategory/${subCategoryName}`;
        }
        else if (req.baseUrl.includes('/api/products')) {
            // Product route
            const productName = req.body.name; // Get the product name from the request body
            folderPath = `uploads/products/${productName}`; // Path for product uploads
        }

        // Create the directory if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        cb(null, folderPath); // Callback with null error and the destination folder
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); // Set the filename
    },
});

// Create an upload middleware
const upload = multer({ storage: storage });

module.exports = upload;
