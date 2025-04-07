const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config(); // Load environment variables

const app = express();
const upload = multer(); // For file uploads
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// PostgreSQL connection (Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Register new user
app.post('/register', async (req, res) => {
    const { email, password, userType } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await pool.query(
            'INSERT INTO usersLogin (email, password, user_type) VALUES ($1, $2, $3) RETURNING *',
            [email, hashedPassword, userType]
        );
        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usersLogin WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password)) {
            const redirectPage = user.user_type === 'employer' ? 'Employer.html' : 'Job%20Seeker.html';
            res.json({ message: 'Login successful', redirect: redirectPage });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload resume
app.post('/upload', upload.single('file'), async (req, res) => {
    const { password } = req.body;
    const { originalname, buffer } = req.file;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await pool.query(
            'INSERT INTO resumes (filename, filedata, password) VALUES ($1, $2, $3) RETURNING *',
            [originalname, buffer, hashedPassword]
        );
        res.json({ message: 'File uploaded successfully!', id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Get resumes by password
app.post('/resumes', async (req, res) => {
    const { password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM resumes WHERE password = $1', [password]);
        if (result.rows.length > 0) {
            res.json(result.rows);
        } else {
            res.status(403).send('Invalid password');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get all resumes
app.get('/resumes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resumes');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Download resume by ID
app.get('/download/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query('SELECT filename, filedata FROM resumes WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            const { filename, filedata } = result.rows[0];
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`
            });
            res.send(filedata);
        } else {
            res.status(404).send('Resume not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Submit employer form
app.post('/submit', async (req, res) => {
    const { companyName, address, experienceneeded, technologyStack } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO employees (company_name, address, experienceneeded, technology_stack) VALUES ($1, $2, $3, $4) RETURNING *',
            [companyName, address, experienceneeded, technologyStack]
        );
        console.log('Data inserted:', result.rows[0]);
        res.send('<h2>Form submitted successfully!</h2><a href="/">Go Back</a>');
    } catch (err) {
        console.error('Error inserting data:', err);
        res.status(500).send('Error inserting data');
    }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM employees');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Error fetching data');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
