import pool from '../config/db.js';

export const toggleFavorite = async (req, res) => {
  const { property_id } = req.body;
  try {
    const connection = await pool.getConnection();
    const [exists] = await connection.execute('SELECT id FROM favorites WHERE user_id = ? AND property_id = ?', [req.user.id, property_id]);

    if (exists.length > 0) {
      await connection.execute('DELETE FROM favorites WHERE user_id = ? AND property_id = ?', [req.user.id, property_id]);
      connection.release();
      return res.json({ favorited: false, message: 'Removed from bookmarks' });
    }

    await connection.execute('INSERT INTO favorites (user_id, property_id) VALUES (?, ?)', [req.user.id, property_id]);
    connection.release();
    res.json({ favorited: true, message: 'Added to bookmarks' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getFavorites = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [favs] = await connection.execute(
      'SELECT p.* FROM favorites f JOIN properties p ON f.property_id = p.id WHERE f.user_id = ?',
      [req.user.id]
    );
    connection.release();
    res.json(favs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
