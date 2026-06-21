const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 8000; // Bind to process.env.PORT for cloud deployment
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456'; // Can be set via environment variable
const DB_PATH = path.join(__dirname, 'database.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Ensure assets/uploads folder exists for local temp uploads
const uploadsDir = path.join(__dirname, 'assets', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Database Helpers for Local Mode
const readDatabase = () => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { categories: [], products: [], videos: [] };
  }
};

const writeDatabase = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
};

// ==========================================
// HYBRID STORAGE CONFIGURATION (LOCAL vs CLOUD)
// ==========================================

const USE_CLOUDINARY = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const USE_MONGODB = !!process.env.MONGODB_URI;

if (USE_CLOUDINARY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('[Cloud Storage] Cloudinary integration enabled.');
} else {
  console.log('[Local Storage] Local disk folders enabled (Cloudinary credentials missing).');
}

// MongoDB Models
let MONGODB_CONNECTED = false;
let CategoryModel, ProductModel, VideoModel;

if (USE_MONGODB) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('[Database] Connected to MongoDB successfully.');
      MONGODB_CONNECTED = true;
    })
    .catch(err => {
      console.error('[Database] Failed to connect to MongoDB:', err);
    });

  const CategorySchema = new mongoose.Schema({
    id: String,
    title: String,
    img: String,
    cloudinary_id: String
  });

  const ProductSchema = new mongoose.Schema({
    id: Number,
    title: String,
    category: String,
    img: String,
    cloudinary_id: String
  });

  const VideoSchema = new mongoose.Schema({
    id: Number,
    title: String,
    desc: String,
    youtubeId: String,
    category: String,
    thumb: String,
    cloudinary_id: String
  });

  CategoryModel = mongoose.model('Category', CategorySchema);
  ProductModel = mongoose.model('Product', ProductSchema);
  VideoModel = mongoose.model('Video', VideoSchema);
} else {
  console.log('[Database] Using local database.json file.');
}

// Security middleware to check admin password header
const checkAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'غير مصرح به - كلمة المرور غير صحيحة' });
  }
};

// ==========================================
// API ENDPOINTS
// ==========================================

// Get database content
app.get('/api/data', async (req, res) => {
  if (USE_MONGODB && MONGODB_CONNECTED) {
    try {
      const categories = await CategoryModel.find({}).lean();
      const products = await ProductModel.find({}).lean();
      const videos = await VideoModel.find({}).lean();
      
      // Seed initial data from database.json if MongoDB is empty
      if (categories.length === 0) {
        const localDb = readDatabase();
        await CategoryModel.insertMany(localDb.categories);
        await ProductModel.insertMany(localDb.products);
        await VideoModel.insertMany(localDb.videos);
        console.log('[Database] Seeded MongoDB with initial data from database.json');
        return res.json(localDb);
      }
      
      res.json({ categories, products, videos });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'خطأ في جلب البيانات من قاعدة البيانات' });
    }
  } else {
    const db = readDatabase();
    res.json(db);
  }
});

// Admin login verification
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'كلمة المرور غير صحيحة' });
  }
});

// Add new product
app.post('/api/upload-product', checkAdmin, upload.single('image'), async (req, res) => {
  const { title, category } = req.body;
  const file = req.file;

  if (!title || !category || !file) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(400).json({ success: false, message: 'العنوان، القسم والصورة مطلوبان' });
  }

  let imageUrl = 'assets/uploads/' + file.filename;
  let cloudinaryId = '';

  if (USE_CLOUDINARY) {
    try {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'al_aqsa_products'
      });
      imageUrl = uploadResult.secure_url;
      cloudinaryId = uploadResult.public_id;
      fs.unlinkSync(file.path); // Delete local temp file after cloud upload
    } catch (err) {
      console.error('Cloudinary error:', err);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(500).json({ success: false, message: 'فشل الرفع السحابي للصورة' });
    }
  }

  const newProduct = {
    id: Date.now(),
    title: title,
    category: category,
    img: imageUrl,
    cloudinary_id: cloudinaryId
  };

  if (USE_MONGODB && MONGODB_CONNECTED) {
    try {
      await ProductModel.create(newProduct);
      res.json({ success: true, product: newProduct });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'فشل الحفظ في قاعدة البيانات' });
    }
  } else {
    const db = readDatabase();
    db.products.push(newProduct);
    writeDatabase(db);
    res.json({ success: true, product: newProduct });
  }
});

// Delete product
app.post('/api/delete-product', checkAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, message: 'معرف المنتج مطلوب' });
  }

  if (USE_MONGODB && MONGODB_CONNECTED) {
    try {
      const product = await ProductModel.findOne({ id: parseInt(id) });
      if (!product) {
        return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
      }

      // Delete from Cloudinary if hosted there
      if (product.cloudinary_id) {
        await cloudinary.uploader.destroy(product.cloudinary_id);
      }

      await ProductModel.deleteOne({ id: parseInt(id) });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'خطأ أثناء حذف المنتج' });
    }
  } else {
    const db = readDatabase();
    const productIndex = db.products.findIndex(p => p.id === parseInt(id));

    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }

    const product = db.products[productIndex];

    // Delete local product image file from disk
    if (product.img && product.img.startsWith('assets/uploads/')) {
      const filePath = path.join(__dirname, product.img);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }
    }

    db.products.splice(productIndex, 1);
    writeDatabase(db);
    res.json({ success: true });
  }
});

// Add new video
app.post('/api/upload-video', checkAdmin, upload.single('image'), async (req, res) => {
  const { title, desc, youtubeId, category } = req.body;
  const file = req.file;

  if (!title || !desc || !youtubeId || !category || !file) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
  }

  let thumbUrl = 'assets/uploads/' + file.filename;
  let cloudinaryId = '';

  if (USE_CLOUDINARY) {
    try {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'al_aqsa_videos'
      });
      thumbUrl = uploadResult.secure_url;
      cloudinaryId = uploadResult.public_id;
      fs.unlinkSync(file.path);
    } catch (err) {
      console.error(err);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(500).json({ success: false, message: 'فشل الرفع السحابي لغلاف الفيديو' });
    }
  }

  const newVideo = {
    id: Date.now(),
    title: title,
    desc: desc,
    youtubeId: youtubeId,
    category: category,
    thumb: thumbUrl,
    cloudinary_id: cloudinaryId
  };

  if (USE_MONGODB && MONGODB_CONNECTED) {
    try {
      await VideoModel.create(newVideo);
      res.json({ success: true, video: newVideo });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'فشل الحفظ في قاعدة البيانات' });
    }
  } else {
    const db = readDatabase();
    db.videos.push(newVideo);
    writeDatabase(db);
    res.json({ success: true, video: newVideo });
  }
});

// Delete video
app.post('/api/delete-video', checkAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, message: 'معرف الفيديو مطلوب' });
  }

  if (USE_MONGODB && MONGODB_CONNECTED) {
    try {
      const video = await VideoModel.findOne({ id: parseInt(id) });
      if (!video) {
        return res.status(404).json({ success: false, message: 'الفيديو غير موجود' });
      }

      if (video.cloudinary_id) {
        await cloudinary.uploader.destroy(video.cloudinary_id);
      }

      await VideoModel.deleteOne({ id: parseInt(id) });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'خطأ أثناء حذف الفيديو' });
    }
  } else {
    const db = readDatabase();
    const videoIndex = db.videos.findIndex(v => v.id === parseInt(id));

    if (videoIndex === -1) {
      return res.status(404).json({ success: false, message: 'الفيديو غير موجود' });
    }

    const video = db.videos[videoIndex];

    // Delete custom video thumbnail from disk
    if (video.thumb && video.thumb.startsWith('assets/uploads/')) {
      const filePath = path.join(__dirname, video.thumb);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }
    }

    db.videos.splice(videoIndex, 1);
    writeDatabase(db);
    res.json({ success: true });
  }
});

// Update category cover image
app.post('/api/upload-category', checkAdmin, upload.single('image'), async (req, res) => {
  const { categoryId } = req.body;
  const file = req.file;

  if (!categoryId || !file) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(400).json({ success: false, message: 'معرف القسم والصورة مطلوبان' });
  }

  let imageUrl = 'assets/uploads/' + file.filename;
  let cloudinaryId = '';

  if (USE_CLOUDINARY) {
    try {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'al_aqsa_categories'
      });
      imageUrl = uploadResult.secure_url;
      cloudinaryId = uploadResult.public_id;
      fs.unlinkSync(file.path);
    } catch (err) {
      console.error(err);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(500).json({ success: false, message: 'فشل الرفع السحابي لغلاف القسم' });
    }
  }

  if (USE_MONGODB && MONGODB_CONNECTED) {
    try {
      const category = await CategoryModel.findOne({ id: categoryId });
      if (!category) {
        return res.status(404).json({ success: false, message: 'القسم غير موجود' });
      }

      if (category.cloudinary_id) {
        await cloudinary.uploader.destroy(category.cloudinary_id);
      }

      category.img = imageUrl;
      category.cloudinary_id = cloudinaryId;
      await category.save();

      res.json({ success: true, category });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'فشل الحفظ في قاعدة البيانات' });
    }
  } else {
    const db = readDatabase();
    const category = db.categories.find(c => c.id === categoryId);

    if (!category) {
      return res.status(404).json({ success: false, message: 'القسم غير موجود' });
    }

    // Delete old image if it was custom uploaded
    if (category.img && category.img.startsWith('assets/uploads/')) {
      const oldPath = path.join(__dirname, category.img);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.error(err);
        }
      }
    }

    category.img = imageUrl;
    writeDatabase(db);
    res.json({ success: true, category });
  }
});

// Update existing video details
app.post('/api/update-video', checkAdmin, async (req, res) => {
  const { id, title, desc, youtubeId, category } = req.body;

  if (!id || !title || !desc || !youtubeId || !category) {
    return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
  }

  if (USE_MONGODB && MONGODB_CONNECTED) {
    try {
      const video = await VideoModel.findOne({ id: parseInt(id) });
      if (!video) {
        return res.status(404).json({ success: false, message: 'الفيديو غير موجود' });
      }

      video.title = title;
      video.desc = desc;
      video.youtubeId = youtubeId;
      video.category = category;
      await video.save();

      res.json({ success: true, video });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'خطأ أثناء تعديل الفيديو' });
    }
  } else {
    const db = readDatabase();
    const video = db.videos.find(v => v.id === parseInt(id));

    if (!video) {
      return res.status(404).json({ success: false, message: 'الفيديو غير موجود' });
    }

    video.title = title;
    video.desc = desc;
    video.youtubeId = youtubeId;
    video.category = category;

    writeDatabase(db);
    res.json({ success: true, video });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
