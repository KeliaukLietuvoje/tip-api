'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

import DbConnection from '../mixins/database.mixin';
import { COMMON_DEFAULT_SCOPES, COMMON_HIDDEN_FIELDS, COMMON_SCOPES, EndpointType } from '../types';
import { UserAuthMeta } from './api.service';

export interface VisitInfo {
  id?: number;
  name: string;
  nameEn?: string;
}

@Service({
  name: 'visitInfos',

  mixins: [
    DbConnection({
      collection: 'visitInfos',
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
      nameEn: 'string',
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
export default class VisitInfosService extends moleculer.Service {
  @Action({
    rest: `GET /enum`,
    auth: EndpointType.PUBLIC,
  })
  async getVisitInfos(ctx: Context<{}, UserAuthMeta>) {
    let items: VisitInfo[] = await ctx.call('visitInfos.find', {
      fields: ['id', 'name', 'nameEn'],
    });

    return items;
  }
}
