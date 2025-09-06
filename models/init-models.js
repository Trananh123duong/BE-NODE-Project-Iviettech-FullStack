var DataTypes = require("sequelize").DataTypes;
var _categories = require("./categories");
var _chapter_images = require("./chapter_images");
var _chapters = require("./chapters");
var _reading_history = require("./reading_history");
var _stories = require("./stories");
var _story_categories = require("./story_categories");
var _story_views = require("./story_views");
var _user_follows = require("./user_follows");
var _users = require("./users");

function initModels(sequelize) {
  var categories = _categories(sequelize, DataTypes);
  var chapter_images = _chapter_images(sequelize, DataTypes);
  var chapters = _chapters(sequelize, DataTypes);
  var reading_history = _reading_history(sequelize, DataTypes);
  var stories = _stories(sequelize, DataTypes);
  var story_categories = _story_categories(sequelize, DataTypes);
  var story_views = _story_views(sequelize, DataTypes);
  var user_follows = _user_follows(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);

  categories.belongsToMany(stories, { as: 'story_id_stories', through: story_categories, foreignKey: "category_id", otherKey: "story_id" });
  stories.belongsToMany(categories, { as: 'category_id_categories', through: story_categories, foreignKey: "story_id", otherKey: "category_id" });
  stories.belongsToMany(users, { as: 'user_id_users', through: user_follows, foreignKey: "story_id", otherKey: "user_id" });
  users.belongsToMany(stories, { as: 'story_id_stories_user_follows', through: user_follows, foreignKey: "user_id", otherKey: "story_id" });
  story_categories.belongsTo(categories, { as: "category", foreignKey: "category_id"});
  categories.hasMany(story_categories, { as: "story_categories", foreignKey: "category_id"});
  chapter_images.belongsTo(chapters, { as: "chapter", foreignKey: "chapter_id"});
  chapters.hasMany(chapter_images, { as: "chapter_images", foreignKey: "chapter_id"});
  reading_history.belongsTo(chapters, { as: "chapter", foreignKey: "chapter_id"});
  chapters.hasMany(reading_history, { as: "reading_histories", foreignKey: "chapter_id"});
  chapters.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(chapters, { as: "chapters", foreignKey: "story_id"});
  reading_history.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(reading_history, { as: "reading_histories", foreignKey: "story_id"});
  story_categories.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(story_categories, { as: "story_categories", foreignKey: "story_id"});
  story_views.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(story_views, { as: "story_views", foreignKey: "story_id"});
  user_follows.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(user_follows, { as: "user_follows", foreignKey: "story_id"});
  reading_history.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(reading_history, { as: "reading_histories", foreignKey: "user_id"});
  user_follows.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(user_follows, { as: "user_follows", foreignKey: "user_id"});

  return {
    categories,
    chapter_images,
    chapters,
    reading_history,
    stories,
    story_categories,
    story_views,
    user_follows,
    users,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
