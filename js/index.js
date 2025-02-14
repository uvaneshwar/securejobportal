const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000; // You can change the port if needed

// Serve static files (HTML, CSS, JS, etc.)
app.use(express.static(path.join(__dirname)));

// Serve index.html on the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
