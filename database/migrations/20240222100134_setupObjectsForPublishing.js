const objectsForPublishingQuery = `
WITH categories_by_form_id AS (
  SELECT
    f.id,
    jsonb_agg(c.name) AS categories
  FROM
    forms f
    CROSS JOIN jsonb_array_elements_text(f.categories) AS category_id
    INNER JOIN categories c ON c.id = category_id :: int
  GROUP BY
    f.id
),
subcategories_by_form_id AS (
  SELECT
    f.id,
    jsonb_agg(c.name) AS sub_categories
  FROM
    forms f
    CROSS JOIN jsonb_array_elements_text(f.sub_categories) AS category_id
    INNER JOIN categories c ON c.id = category_id :: int
  GROUP BY
    f.id
),
additional_infos_by_form_id AS (
  SELECT
    f.id,
    jsonb_agg(ai.name) AS additional_infos
  FROM
    forms f
    CROSS JOIN jsonb_array_elements_text(f.additional_infos) AS additional_info_id
    INNER JOIN additional_infos ai ON ai.id = additional_info_id :: int
  GROUP BY
    f.id
),
form_data_by_form_id AS (
  SELECT
    f.id,
    c.categories,
    sc.sub_categories,
    ai.additional_infos
  FROM
    forms f
    LEFT JOIN subcategories_by_form_id sc ON sc.id = f.id
    LEFT JOIN additional_infos_by_form_id ai ON ai.id = f.id
    LEFT JOIN categories_by_form_id c ON c.id = f.id
)
SELECT
  f.id,
  f.name_lt,
  f.name AS name_en,
  f.description_lt,
  f.description AS description_en,
  f.url AS url_en,
  f.url_lt,
  f.visit_duration,
  vi."name" AS visit_info,
  f.seasons,
  f.is_paid,
  f.is_adapted_for_foreigners,
  f.photos,
  f.geom,
  f.is_active,
  fd.categories,
  fd.sub_categories,
  fd.additional_infos
FROM
  "forms" f
  LEFT JOIN visit_infos vi ON vi.id = f.visit_info_id
  LEFT JOIN form_data_by_form_id fd ON fd.id = f.id
WHERE
  f.status = 'APPROVED'
  AND f.deleted_at IS NULL
`;

exports.up = function (knex) {
  return knex.schema
    .raw("CREATE SCHEMA IF NOT EXISTS publishing")
    .withSchema("publishing")
    .createViewOrReplace("objects", function (view) {
      view.as(knex.raw(objectsForPublishingQuery));
    });
};

exports.down = function (knex) {
  return knex.schema
    .withSchema("publishing")
    .dropViewIfExists("objects")
    .raw("DROP SCHEMA IF EXISTS publishing");
};
