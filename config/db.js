const { Sequelize } = require('sequelize');


// Tạo một instance của Sequelize để kết nối CSDL
const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql' // Khai báo RDB CSDL đang dùng là MySQL
  }
);

// Kiểm tra kết nối (tùy chọn nhưng nên có)
const checkConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection via Sequelize has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

checkConnection();

// Xuất ra instance để sử dụng ở các file khác
module.exports = sequelize;
