'use strict';

import moleculer, { Context, RestSchema } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

import DbConnection from '../mixins/database.mixin';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_HIDDEN_FIELDS,
  COMMON_SCOPES,
  EndpointType,
  IMAGE_TYPES,
} from '../types';

const folderName = 'uploads/icons';

export interface AdditionalInfos {
  id?: number;
  name: string;
  nameEn?: string;
  icon?: string;
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
      nameEn: 'string',
      icon: 'string',
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
  async getVisitInfos(ctx: Context) {
    let items: AdditionalInfos[] = await ctx.call('additionalInfos.find', {
      fields: ['id', 'name', 'nameEn', 'icon'],
    });

    return items;
  }

  @Action({
    rest: 'GET /icons',
    auth: EndpointType.PUBLIC,
  })
  async getIcons(ctx: Context<{ url: string }>) {
    return ctx.call('minio.listFiles', {
      path: folderName,
    });
  }

  @Action({
    rest: <RestSchema>{
      method: 'DELETE',
      path: '/icons',
    },
    params: {
      url: 'string',
    },
    auth: EndpointType.ADMIN,
  })
  async removeIcon(ctx: Context<{ url: string }>) {
    const url = new URL(ctx.params.url);

    return ctx.call('minio.removeFile', {
      path: url.pathname.slice(1),
    });
  }

  @Action({
    rest: <RestSchema>{
      method: 'POST',
      path: '/icons',
      type: 'multipart',
      busboyConfig: {
        limits: {
          files: 1,
        },
      },
    },
    auth: EndpointType.ADMIN,
  })
  async uploadIcon(ctx: Context) {
    return ctx.call('minio.uploadFile', {
      payload: ctx.params,
      isPrivate: false,
      types: IMAGE_TYPES,
      folder: folderName,
    });
  }
}
