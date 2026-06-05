const db = require('../config/db');

exports.toggleFavorite = async (req, res) => {
  const { property_id } = req.body;
  try {
    const [exists] = await db.execute('SELECT id FROM favorites WHERE user_id = ? AND property_id = ?', [req.user.id, property_id]);
    if (exists.length > 0) {
      await db.execute('DELETE FROM favorites WHERE user_id = ? AND property_id = ?', [req.user.id, property_id]);
      return res.json({ favorited: false, message: 'Removed from bookmarks' });
    }
    await db.execute('INSERT INTO favorites (user_id, property_id) VALUES (?, ?)', [req.user.id, property_id]);
    res.json({ favorited: true, message: 'Added to bookmarks' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const [favs] = await db.execute(
      `SELECT p.*, (SELECT image_url FROM property_images WHERE property_id = p.id LIMIT 1) as main_image 
       FROM favorites f JOIN properties p ON f.property_id = p.id WHERE f.user_id = ?`,
      [req.user.id]
    );
    res.json(favs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};