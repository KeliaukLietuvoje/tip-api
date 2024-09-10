'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { COMMON_DEFAULT_SCOPES, COMMON_HIDDEN_FIELDS, COMMON_SCOPES, EndpointType } from '../types';
import { UserAuthMeta } from './api.service';

export interface Category {
  id?: number;
  name: string;
  parent?: Category;
  children?: Category[];
}

@Service({
  name: 'categories',

  mixins: [
    DbConnection({
      collection: 'categories',
    }),
  ],

  settings: {
    fields: {
      id: {
        type: 'string',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },

      name: 'string',
      parent: {
        type: 'number',
        columnType: 'integer',
        columnName: 'parentId',
        populate: {
          action: 'categories.resolve',
          params: {
            populate: 'parent',
          },
        },
      },
      children: {
        virtual: true,
        type: 'array',
        populate: {
          keyField: 'id',
          action: 'categories.populateByProp',
          params: {
            populate: 'children',
            sort: 'name',
            mappingMulti: true,
            queryKey: 'parent',
          },
        },
      },

      ...COMMON_HIDDEN_FIELDS,
    },

    scopes: {
      ...COMMON_SCOPES,
    },

    defaultScopes: [...COMMON_DEFAULT_SCOPES],
    actions: {
      remove: {
        types: [EndpointType.ADMIN],
      },
      create: {
        types: [EndpointType.ADMIN],
      },
      update: {
        types: [EndpointType.ADMIN],
      },
    },
  },
})
export default class CategoriesService extends moleculer.Service {
  @Method
  mapCategories(items: Category[]): any[] {
    return items.map((item) => {
      return {
        name: item.name,
        ...(Array.isArray(item.children) && {
          children: this.mapCategories(item.children),
        }),
      };
    });
  }

  @Action({
    rest: `GET /enum`,
    auth: EndpointType.PUBLIC,
  })
  async categories(ctx: Context<{}, UserAuthMeta>) {
    let items: Category[] = await ctx.call('categories.find', {
      populate: 'children',
      fields: ['id', 'name', 'children'],
    });

    return this.mapCategories(items);
  }
}
