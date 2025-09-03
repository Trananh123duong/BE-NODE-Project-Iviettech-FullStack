require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const crawlRouters = require('./routes/crawl');
const userPageCategoryRoutes = require('./routes/user/category.route')
const userPageStoryRoutes = require('./routes/user/story.route')
const userPageSChapterRoutes = require('./routes/user/chapter.route')

const errorHandler = require('./middleware/errorHandler');

const app = express()
const port = process.env.PORT;

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//routes
app.use('/crawl', crawlRouters);
app.use('/api/categories', userPageCategoryRoutes);
app.use('/api/stories', userPageStoryRoutes);
app.use('/api/chapters', userPageSChapterRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`)
})