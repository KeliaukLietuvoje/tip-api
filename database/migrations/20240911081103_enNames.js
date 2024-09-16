/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .alterTable('categories', (table) => {
      table.string('nameEn');
    })
    .alterTable('additionalInfos', (table) => {
      table.string('nameEn');
      table.string('icon');
    })
    .alterTable('visitInfos', (table) => {
      table.string('nameEn');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .alterTable('categories', (table) => {
      table.dropColumn('nameEn');
    })
    .alterTable('additionalInfos', (table) => {
      table.dropColumn('nameEn');
      table.dropColumn('icon');
    })
    .alterTable('visitInfos', (table) => {
      table.dropColumn('nameEn');
    });
};
