const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('chapter_images', {
    id: {
      autoIncrement: true,
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    chapter_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'chapters',
        key: 'id'
      }
    },
    img_path: {
      type: DataTypes.STRING(1024),
      allowNull: false
    },
    img_type: {
      type: DataTypes.ENUM('EXTERNAL','INTERNAL'),
      allowNull: false,
      defaultValue: "EXTERNAL"
    },
    sort_order: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'chapter_images',
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
        name: "idx_cimg_chapter",
        using: "BTREE",
        fields: [
          { name: "chapter_id" },
        ]
      },
      {
        name: "idx_cimg_sort",
        using: "BTREE",
        fields: [
          { name: "chapter_id" },
        ]
      },
    ]
  });
};
