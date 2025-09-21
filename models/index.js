const sequelize = require('../config/db')
const initModels = require('./init-models')

const models = initModels(sequelize)

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'

function toAbsoluteUrl(p) {
  if (!p) return p
  // đã là absolute URL thì giữ nguyên
  if (/^(?:https?:)?\/\//i.test(p)) return p
  // chốt lại một dấu '/'
  return p.startsWith('/') ? `${BASE_URL}${p}` : `${BASE_URL}/${p}`
}

if (models.stories) {
  const origToJSON = models.stories.prototype.toJSON
  models.stories.prototype.toJSON = function () {
    // Lấy plain object an toàn
    const values = typeof origToJSON === 'function'
      ? origToJSON.call(this)
      : this.get({ plain: true })

    values.thumbnail = toAbsoluteUrl(values.thumbnail)
    return values
  }
}

if (models.users) {
  const origToJSONUser = models.users.prototype.toJSON
  models.users.prototype.toJSON = function () {
    const values = typeof origToJSONUser === 'function'
      ? origToJSONUser.call(this)
      : this.get({ plain: true })
    values.avatar = toAbsoluteUrl(values.avatar)
    return values
  }
}

module.exports = models