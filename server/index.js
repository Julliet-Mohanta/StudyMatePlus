const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Configure CORS policies right away
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Extra header injection middleware to allow iframes/objects to preview files without security blocks
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("X-Frame-Options", "ALLOWALL"); 
  res.header("Content-Security-Policy", "frame-ancestors 'self' http://localhost:3000");
  next();
});

app.use(express.json());

// 2. Local physical file storage setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// 3. Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('StudyMatePlus API Database is running ✅'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Database Model
const NoteSchema = new mongoose.Schema({
  title: String, 
  university: String, 
  department: String,
  semester: Number, 
  subject: String, 
  link: String,
  fileType: String, 
  fileSize: String, 
  downloadCount: { type: Number, default: 0 },
  uploadDate: { type: Date, default: Date.now }
});
const Note = mongoose.models.Note || mongoose.model('Note', NoteSchema);

// ADDED MISSING GET ROUTE SO HOME LOAD WORKS 
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await Note.find({}).sort({ uploadDate: -1 });
    return res.status(200).json(notes);
  } catch (error) {
    console.error("Fetch items database error:", error);
    return res.status(500).json({ message: 'Error retrieving files' });
  }
});

// 4. File upload endpoint routing
app.post('/api/notes/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file received' });
    }

    // Convert relative reference into absolute accessible destination URL path address
    const fileLink = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    const fileExtension = path.extname(req.file.originalname).substring(1).toUpperCase() || 'PDF';
    const computedSize = `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`;

    const newNote = new Note({
      title: req.body.title || req.file.originalname.split('.')[0],
      university: req.body.university || "General",
      department: req.body.department || "General",
      semester: Number(req.body.semester) || 1,
      subject: req.body.subject || "General",
      link: fileLink,
      fileType: fileExtension,
      fileSize: computedSize,
      downloadCount: 0
    });

    await newNote.save();
    
    // CRITICAL FIX: Return the note directly so your frontend array matches exactly what it needs
    return res.status(201).json(newNote);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server processing error' });
  }
});

// Serve assets directory publicly
app.use('/uploads', express.static(uploadDir));

app.get('/', (req, res) => {
  res.send('StudyMatePlus API is running smoothly.');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});