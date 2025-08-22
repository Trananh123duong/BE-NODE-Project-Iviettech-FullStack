const express = require('express')
const path = require('path')
const morgan = require('morgan')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')

const app = express()

app.use(express.static('public'))
app.use(express.json())
app.use(morgan('dev'))
app.use(cors())

app.listen(3000, () => {
  console.log('Đã chạy ok')
})