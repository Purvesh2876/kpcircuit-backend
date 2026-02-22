const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const subcategoryRoutes = require('./routes/subcategoryRoutes');
const upload = require('./config/multerConfig'); // Path to your multer config
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://76.13.247.39',
    'http://76.13.247.39:3000',
    'http://76.13.247.39:3001'
  ],
  credentials: true,
}));
app.use(express.json()); // For parsing application/json
app.use(cookieParser()); // For parsing cookiess

// Add multer to handle multipart/form-data

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/subcategory', subcategoryRoutes);

// Connect to MongoDB
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
  app.listen(5000, () => console.log('Server running on port 5000'));
}).catch(err => console.error(err));
