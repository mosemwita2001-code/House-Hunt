import pool from '../config/db.js';

export const getMetrics = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [[users]] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [[properties]] = await connection.execute('SELECT COUNT(*) as count FROM properties');
    const [[active]] = await connection.execute("SELECT COUNT(*) as count FROM properties WHERE status = 'approved'");
    const [[pending]] = await connection.execute("SELECT COUNT(*) as count FROM properties WHERE status = 'pending'");

    connection.release();

    res.json({
      totalUsers: users.count,
      totalProperties: properties.count,
      activeProperties: active.count,
      pendingProperties: pending.count
    });
  } catch (err) {
    console.error('Metrics error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getAdminProperties = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [properties] = await connection.execute(
      'SELECT p.*, u.name as landlord_name FROM properties p JOIN users u ON p.landlord_id = u.id'
    );
    connection.release();
    res.json(properties);
  } catch (err) {
    console.error('Admin properties error:', err);
    res.status(500).json({ message: err.message });
  }
};
