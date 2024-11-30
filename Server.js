const express = require('express');
const { Pool } = require('pg'); // PostgreSQL pool
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const db = new Pool({
    host: 'localhost',
    user: 'postgres', // Your PostgreSQL user
    password: '123456', // Your PostgreSQL password
    database: 'wings_cafe', // Your database name
    port: 5432 // Default PostgreSQL port
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
        return;
    }
    console.log('Connected to PostgreSQL database.');
});

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Define a simple route
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// User Registration route
app.post('/users', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
        res.status(201).json({ username });
    } catch (err) {
        console.error('Database error during user registration:', err);
        res.status(500).json({ error: 'Error registering user', details: err.message });
    }
});

// Route to update stock
app.post('/stock', (req, res) => {
    const { productId, quantity, type } = req.body;
    const quantityChange = type === 'add' ? quantity : -quantity;

    db.query(
        'UPDATE products SET quantity = GREATEST(0, quantity + $1) WHERE id = $2 RETURNING *',
        [quantityChange, productId],
        (err, results) => {
            if (err) {
                console.error('Database error while updating stock:', err);
                return res.status(500).json({ error: 'Error updating stock', details: err.message });
            }
            if (results.rowCount === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }
            res.json({ success: true, product: results.rows[0] });
        }
    );
});

// Route to handle product sales
app.post('/sell', (req, res) => {
    const { productId, quantity } = req.body;

    db.query(
        'UPDATE products SET quantity = GREATEST(0, quantity - $1) WHERE id = $2 RETURNING *',
        [quantity, productId],
        (err, results) => {
            if (err) {
                console.error('Database error while processing sale:', err);
                return res.status(500).json({ error: 'Error processing sale', details: err.message });
            }
            if (results.rowCount === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }
            res.json({ success: true, product: results.rows[0] });
        }
    );
});

// User Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        res.status(200).json({ username: user.username });
    } catch (err) {
        console.error('Database error during login:', err);
        res.status(500).json({ error: 'Error logging in', details: err.message });
    }
});

// Route to get all users
app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            console.error('Database error while fetching users:', err);
            return res.status(500).json({ error: 'Error fetching users', details: err.message });
        }
        res.json(results.rows);
    });
});

// Route to get all products
app.get('/products', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Error fetching products', details: err.message });
    }
});

// Route to add a new product
app.post('/products', async (req, res) => {
    const { productname, description, category, price, quantity } = req.body;

    try {
        const result = await db.query(
            'INSERT INTO products (productname, description, category, price, quantity) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [productname, description, category, price, quantity]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Error adding product' });
    }
});

// Route to update a product by ID
app.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { productname, description, category, price, quantity } = req.body;

    if (!productname || !description || !category || price == null || quantity == null) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const result = await db.query(
            'UPDATE products SET productname = $1, description = $2, category = $3, price = $4, quantity = $5 WHERE id = $6 RETURNING *',
            [productname, description, category, price, quantity, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.status(200).json({
            message: 'Product updated successfully',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('Database error during product update:', err);
        return res.status(500).json({ error: 'Error updating product', details: err.message });
    }
});

// Route to delete a product by ID
app.delete('/products/:id', (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM products WHERE id = $1', [id], (err, result) => {
        if (err) {
            console.error('Database error while deleting product:', err);
            return res.status(500).json({ error: 'Error deleting product', details: err.message });
        }
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.status(204).send();
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});