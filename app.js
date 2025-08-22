require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');

const app = express()
const port = process.env.PORT;

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//routes

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`)
})