require('dotenv').config(); // should be first or near the top
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');  // Encryption used in db
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');


const app = express();
const upload = multer();  // resume upload
const PORT = process.env.PORT || 3000;  // port 3000
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL connection
//const pool = new Pool({
 ///   user: 'postgres',          // Replace with your PostgreSQL user
    //host: 'localhost',
    //database: 'postgres',      // Replace with your database name
   // password: 'admin',         // Replace with your password
    //port: 5432,
//});

app.use(cors());
app.use(bodyParser.json());




// Serve static files from the root, lib, and images directories
app.use(express.static(path.join(__dirname))); // This serves files from the root
app.use('/lib', express.static(path.join(__dirname, 'lib'))); // This serves files from lib
app.use('/images', express.static(path.join(__dirname, 'images'))); // This serves files from images

// Serve the index.html file[Responds to requests to the root URL with the index.html file.]
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Registration endpoint 
app.post('/register', async (req, res) => {
    const { email, password, userType } = req.body; // Get userType from request

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    try {
        const result = await pool.query(
            'INSERT INTO usersLogin (email, password, user_type) VALUES ($1, $2, $3) RETURNING *',
            [email, hashedPassword, userType] // Store userType in the database
        );
        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (err) {
        // Handle specific error cases
        if (err.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});


// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Fetch user by email
        const result = await pool.query('SELECT * FROM usersLogin WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user) {
            // Compare hashed password
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                // Redirect based on user type
                const redirectPage = user.user_type === 'employer' ? 'Employer.html' : 'Job%20Seeker.html';
                res.json({ message: 'Login successful', redirect: redirectPage });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/upload', upload.single('file'), async (req, res) => {
    const { password } = req.body;
    const { originalname, buffer } = req.file;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

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




// Endpoint to get resumes based on password
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

function fetchResumes() {
    $.ajax({
        url: 'http://localhost:3000/resumes', // This should match your Express server URL
        method: 'GET',
        success: function(data) {
            displayResumes(data);
        },
        error: function(error) {
            console.error('Error fetching resumes:', error);
        }
    });
}

// Route to fetch resumes
app.get('/resumes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resumes');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Route to download resume
app.get('/download/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query('SELECT filename, filedata FROM resumes WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            const { filename, filedata } = result.rows[0];
            res.set({
                'Content-Type': 'application/pdf', // Adjust content type based on file type
                'Content-Disposition': `attachment; filename="${filename}"`,
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

// Route to handle form submission
app.post('/submit', async (req, res) => {
    const { companyName, address, experienceneeded, technologyStack } = req.body;

    try {
        const query = `
        INSERT INTO employees (company_name, address, experienceneeded, technology_stack)
        VALUES ($1, $2, $3, $4) RETURNING *`;
    const values = [companyName, address, experienceneeded, technologyStack];
    
    const result = await pool.query(query, values);
    console.log('Data inserted:', result.rows[0]);

    res.send('<h2>Form submitted successfully!</h2><a href="/">Go Back</a>');
    } catch (err) {
        console.error('Error inserting data:', err);
        res.status(500).send('Error inserting data');
    }
});


app.get('/api/employees', async (req, res) => {
    console.log("🔍 API hit: /api/employees");
    try {
        const result = await pool.query('SELECT * FROM employees');
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching data:', err.message);
        res.status(500).send('Error fetching data');
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.get('/health', (req, res) => {
    res.send('OK');
  });
  