const db = require('../config/db'); 

// Fetch only the properties owned by the logged-in landlord
exports.getMyProperties = async (req, res) => {
    try {
        // req.user.id comes from your authMiddleware
        const [rows] = await db.execute(
            'SELECT * FROM properties WHERE landlord_id = ?', 
            [req.user.id] 
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching your properties" });
    }
};

// Add a new property (linked to the logged-in landlord)
exports.createProperty = async (req, res) => {
    const { title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, phone_number } = req.body;
    const imagePath = req.files && req.files[0] ? req.files[0].filename : null;

    try {
        const sql = `INSERT INTO properties 
            (title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, phone_number, image_path, landlord_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
        await db.execute(sql, [
            title, description, price, deposit, county, town, 
            house_type, bedrooms, bathrooms, phone_number, imagePath, 
            req.user.id 
        ]);
        
        res.status(201).json({ message: 'Property listed successfully!' });
    } catch (err) {
        res.status(500).json({ message: 'Error saving property', error: err.message });
    }
};