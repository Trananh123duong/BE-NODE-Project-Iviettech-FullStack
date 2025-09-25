const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('story_comments', {
    id: {
      autoIncrement: true,
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    story_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'stories',
        key: 'id'
      }
    },
    chapter_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'chapters',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    parent_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'story_comments',
        key: 'id'
      }
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'story_comments',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "idx_cmt_story_time",
        using: "BTREE",
        fields: [
          { name: "story_id" },
          { name: "created_at" },
        ]
      },
      {
        name: "idx_cmt_chapter_time",
        using: "BTREE",
        fields: [
          { name: "chapter_id" },
          { name: "created_at" },
        ]
      },
      {
        name: "idx_cmt_parent",
        using: "BTREE",
        fields: [
          { name: "parent_id" },
        ]
      },
      {
        name: "idx_cmt_user",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
    ]
  });
};
