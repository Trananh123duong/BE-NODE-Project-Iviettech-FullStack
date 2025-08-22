const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('chapters', {
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
    chapter_number: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'chapters',
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
        name: "uk_chapters_story_no",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "story_id" },
          { name: "chapter_number" },
        ]
      },
      {
        name: "idx_chapters_story",
        using: "BTREE",
        fields: [
          { name: "story_id" },
        ]
      },
    ]
  });
};
