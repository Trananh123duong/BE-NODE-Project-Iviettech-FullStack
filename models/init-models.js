var DataTypes = require("sequelize").DataTypes;
var _categories = require("./categories");
var _chapter_images = require("./chapter_images");
var _chapters = require("./chapters");
var _comment_likes = require("./comment_likes");
var _reading_history = require("./reading_history");
var _stories = require("./stories");
var _story_categories = require("./story_categories");
var _story_comments = require("./story_comments");
var _story_ratings = require("./story_ratings");
var _story_views = require("./story_views");
var _user_follows = require("./user_follows");
var _users = require("./users");
var _vip_purchases = require("./vip_purchases");

function initModels(sequelize) {
  var categories = _categories(sequelize, DataTypes);
  var chapter_images = _chapter_images(sequelize, DataTypes);
  var chapters = _chapters(sequelize, DataTypes);
  var comment_likes = _comment_likes(sequelize, DataTypes);
  var reading_history = _reading_history(sequelize, DataTypes);
  var stories = _stories(sequelize, DataTypes);
  var story_categories = _story_categories(sequelize, DataTypes);
  var story_comments = _story_comments(sequelize, DataTypes);
  var story_ratings = _story_ratings(sequelize, DataTypes);
  var story_views = _story_views(sequelize, DataTypes);
  var user_follows = _user_follows(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);
  var vip_purchases = _vip_purchases(sequelize, DataTypes);

  categories.belongsToMany(stories, { as: 'story_id_stories', through: story_categories, foreignKey: "category_id", otherKey: "story_id" });
  stories.belongsToMany(categories, { as: 'category_id_categories', through: story_categories, foreignKey: "story_id", otherKey: "category_id" });
  stories.belongsToMany(users, { as: 'user_id_users_story_ratings', through: story_ratings, foreignKey: "story_id", otherKey: "user_id" });
  stories.belongsToMany(users, { as: 'user_id_users_user_follows', through: user_follows, foreignKey: "story_id", otherKey: "user_id" });
  story_comments.belongsToMany(users, { as: 'user_id_users', through: comment_likes, foreignKey: "comment_id", otherKey: "user_id" });
  users.belongsToMany(stories, { as: 'story_id_stories_story_ratings', through: story_ratings, foreignKey: "user_id", otherKey: "story_id" });
  users.belongsToMany(stories, { as: 'story_id_stories_user_follows', through: user_follows, foreignKey: "user_id", otherKey: "story_id" });
  users.belongsToMany(story_comments, { as: 'comment_id_story_comments', through: comment_likes, foreignKey: "user_id", otherKey: "comment_id" });
  story_categories.belongsTo(categories, { as: "category", foreignKey: "category_id"});
  categories.hasMany(story_categories, { as: "story_categories", foreignKey: "category_id"});
  chapter_images.belongsTo(chapters, { as: "chapter", foreignKey: "chapter_id"});
  chapters.hasMany(chapter_images, { as: "chapter_images", foreignKey: "chapter_id"});
  reading_history.belongsTo(chapters, { as: "chapter", foreignKey: "chapter_id"});
  chapters.hasMany(reading_history, { as: "reading_histories", foreignKey: "chapter_id"});
  story_comments.belongsTo(chapters, { as: "chapter", foreignKey: "chapter_id"});
  chapters.hasMany(story_comments, { as: "story_comments", foreignKey: "chapter_id"});
  chapters.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(chapters, { as: "chapters", foreignKey: "story_id"});
  reading_history.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(reading_history, { as: "reading_histories", foreignKey: "story_id"});
  story_categories.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(story_categories, { as: "story_categories", foreignKey: "story_id"});
  story_comments.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(story_comments, { as: "story_comments", foreignKey: "story_id"});
  story_ratings.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(story_ratings, { as: "story_ratings", foreignKey: "story_id"});
  story_views.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(story_views, { as: "story_views", foreignKey: "story_id"});
  user_follows.belongsTo(stories, { as: "story", foreignKey: "story_id"});
  stories.hasMany(user_follows, { as: "user_follows", foreignKey: "story_id"});
  comment_likes.belongsTo(story_comments, { as: "comment", foreignKey: "comment_id"});
  story_comments.hasMany(comment_likes, { as: "comment_likes", foreignKey: "comment_id"});
  story_comments.belongsTo(story_comments, { as: "parent", foreignKey: "parent_id"});
  story_comments.hasMany(story_comments, { as: "story_comments", foreignKey: "parent_id"});
  comment_likes.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(comment_likes, { as: "comment_likes", foreignKey: "user_id"});
  reading_history.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(reading_history, { as: "reading_histories", foreignKey: "user_id"});
  story_comments.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(story_comments, { as: "story_comments", foreignKey: "user_id"});
  story_ratings.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(story_ratings, { as: "story_ratings", foreignKey: "user_id"});
  user_follows.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(user_follows, { as: "user_follows", foreignKey: "user_id"});
  vip_purchases.belongsTo(users, { as: "user", foreignKey: "user_id"});
  users.hasMany(vip_purchases, { as: "vip_purchases", foreignKey: "user_id"});

  return {
    categories,
    chapter_images,
    chapters,
    comment_likes,
    reading_history,
    stories,
    story_categories,
    story_comments,
    story_ratings,
    story_views,
    user_follows,
    users,
    vip_purchases,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
