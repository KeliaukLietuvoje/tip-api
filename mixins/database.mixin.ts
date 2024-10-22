'use strict';

import { DatabaseMixin } from '@aplinkosministerija/moleculer-accounts';
import { Context } from 'moleculer';
import filtersMixin from 'moleculer-knex-filters';
import config from '../knexfile';

type rawStatementSanitized = { condition: string; bindings?: unknown[] };
type rawStatement = string | rawStatementSanitized;

function sanitizeRaw(statement: rawStatement): rawStatementSanitized {
  return {
    condition: typeof statement === 'string' ? statement : statement.condition,
    bindings: typeof statement === 'string' ? [] : statement.bindings || [],
  };
}

export function mergeRaw(extend: rawStatement, base?: rawStatement): rawStatement {
  if (!base) {
    return extend;
  }

  base = sanitizeRaw(base);
  extend = sanitizeRaw(extend);

  return {
    condition: `(${base.condition}) AND (${extend.condition})`,
    bindings: [...base.bindings, ...extend.bindings],
  };
}

export const MaterializedView = {
  OBJECTS: 'publishing.objects',
};

export default function (opts: any = {}) {
  const schema = {
    mixins: [DatabaseMixin(opts.config || config, opts), filtersMixin()],

    methods: {
      async refreshMaterializedView(ctx: Context, name: string) {
        const adapter = await this.getAdapter(ctx);

        await adapter.client.schema.refreshMaterializedView(name);
        return {
          success: true,
        };
      },
    },
  };

  return schema;
}
