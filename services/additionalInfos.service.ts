'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

import DbConnection from '../mixins/database.mixin';
import { COMMON_DEFAULT_SCOPES, COMMON_HIDDEN_FIELDS, COMMON_SCOPES, EndpointType } from '../types';
import { UserAuthMeta } from './api.service';

export interface AdditionalInfos {
  id?: number;
  name: string;
}

@Service({
  name: 'additionalInfos',

  mixins: [
    DbConnection({
      collection: 'additionalInfos',
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
export default class FormHistoriesService extends moleculer.Service {
  @Action({
    rest: `GET /enum`,
    auth: EndpointType.PUBLIC,
  })
  async getVisitInfos(ctx: Context<{}, UserAuthMeta>) {
    let items: AdditionalInfos[] = await ctx.call('additionalInfos.find', {
      fields: ['id', 'name'],
    });

    return items;
  }
}
