import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  port:               Number(process.env.DB_PORT) || 3306,
  ssl:                { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

pool.getConnection()
  .then(c => { 
    console.log('✅ MySQL connected to:', process.env.DB_HOST); 
    c.release(); 
  })
  .catch(e => {
    console.error('❌ MySQL connection failed:', e.message, e.code);
    console.error('Tried connecting to:', process.env.DB_HOST, 'on port:', process.env.DB_PORT);
  });

export default pool;