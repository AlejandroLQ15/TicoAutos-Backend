// server/index.js
const mongoose = require('mongoose');

//Here you define the URL and the database name
mongoose.connect('mongodb://127.0.0.1:27017/ticoautos'); 

const database = mongoose.connection;

// Connection error handling //Manejo
database.on('error', (error) => { 
    console.log(error); 
});

// Confirmation of successful connection
database.once('connected', () => {
    console.log('Database Connected');
});
// Express setup
const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for frontend communication
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Import and mount user routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Import and mount autos routes
const autosRoutes = require('./routes/autos');
app.use('/api/autos', autosRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});