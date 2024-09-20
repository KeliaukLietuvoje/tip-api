const { query: oldQuery } = require('./20240807153103_setupObjectsForPublishingMaterializedView');

const query = `
WITH categories_by_form_id AS (
  SELECT
    f.id,
    coalesce(
      jsonb_agg(
        DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'nameEn', c.name_en)
      ) FILTER (
        WHERE
          c.id IS NOT NULL
      ),
      '[]' :: jsonb
    ) AS categories
  FROM
    forms f
    LEFT JOIN jsonb_array_elements_text(f.categories) AS category_id ON TRUE
    LEFT JOIN categories c ON c.id = category_id :: int
  GROUP BY
    f.id
),
subcategories_by_form_id AS (
  SELECT
    f.id,
    coalesce(
      jsonb_agg(
        DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'nameEn', c.name_en)
      ) FILTER (
        WHERE
          c.id IS NOT NULL
      ),
      '[]' :: jsonb
    ) AS sub_categories
  FROM
    forms f
    LEFT JOIN jsonb_array_elements_text(f.sub_categories) AS category_id
    LEFT JOIN categories c ON c.id = category_id :: int ON TRUE
  GROUP BY
    f.id
),
additional_infos_by_form_id AS (
  SELECT
    f.id,
    coalesce(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id',
          ai.id,
          'name',
          ai.name,
          'nameEn',
          ai.name_en,
          'icon',
          ai.icon
        )
      ) FILTER (
        WHERE
          ai.id IS NOT NULL
      ),
      '[]' :: jsonb
    ) AS additional_infos
  FROM
    forms f
    LEFT JOIN jsonb_array_elements_text(f.additional_infos) AS additional_info_id ON TRUE
    LEFT JOIN additional_infos ai ON ai.id = additional_info_id :: int
  GROUP BY
    f.id
),
form_data_by_form_id AS (
  SELECT
    f.id,
    coalesce(c.categories, '[]' :: jsonb) AS categories,
    coalesce(sc.sub_categories, '[]' :: jsonb) AS sub_categories,
    coalesce(ai.additional_infos, '[]' :: jsonb) AS additional_infos
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
  CASE
    WHEN vi.id IS NOT NULL THEN jsonb_build_object(
      'id',
      vi.id,
      'name',
      vi.name,
      'nameEn',
      vi.name_en
    )
    ELSE NULL
  END AS visit_info,
  f.seasons,
  coalesce(f.is_paid, false) AS is_paid,
  coalesce(f.is_adapted_for_foreigners, false) AS is_adapted_for_foreigners,
  f.photos,
  f.geom,
  coalesce(f.is_active, false) AS is_active,
  f.created_at,
  fd.categories,
  fd.sub_categories,
  fd.additional_infos,
  CASE
    WHEN t.id IS NOT NULL THEN jsonb_build_object(
      'id',
      t.id,
      'name',
      t.name,
      'code',
      t.code
    )
    ELSE NULL
  END AS tenant
FROM
  "forms" f
  LEFT JOIN visit_infos vi ON vi.id = f.visit_info_id
  LEFT JOIN form_data_by_form_id fd ON fd.id = f.id
  LEFT JOIN tenants t ON t.id = f.tenant_id
WHERE
  f.status = 'APPROVED'
  AND f.deleted_at IS NULL
`;

exports.up = function (knex) {
  return knex.schema
    .withSchema('publishing')
    .raw(`DROP INDEX publishing.objects_geom_idx`)
    .dropMaterializedView('objects')
    .createMaterializedView('objects', function (view) {
      view.as(knex.raw(query));
    })
    .raw(`CREATE INDEX objects_geom_idx ON publishing.objects USING GIST (geom)`);
};

exports.down = function (knex) {
  return knex.schema
    .withSchema('publishing')
    .raw(`DROP INDEX publishing.objects_geom_idx`)
    .dropMaterializedView('objects')
    .createMaterializedView('objects', function (view) {
      view.as(knex.raw(oldQuery));
    })
    .raw(`CREATE INDEX objects_geom_idx ON publishing.objects USING GIST (geom)`);
};
