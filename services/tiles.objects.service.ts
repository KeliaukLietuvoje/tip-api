'use strict';

import { TilesMixin } from '@aplinkosministerija/moleculer-accounts';
import moleculer from 'moleculer';
import { Event, Service } from 'moleculer-decorators';
import config from '../knexfile';
import { MaterializedView } from '../mixins/database.mixin';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  EndpointType,
  LKS_SRID,
} from '../types';

const isLocalDevelopment = process.env.NODE_ENV === 'local';

@Service({
  name: 'tiles.objects',
  mixins: [
    TilesMixin({
      config,
      opts: {
        collection: MaterializedView.OBJECTS,
      },
      srid: LKS_SRID,
      layerName: 'objects',
      maxClusteringZoomLevel: 12,
      preloadClustersOnStart: !isLocalDevelopment,
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

      descriptionLt: 'string',
      descriptionEn: 'string',

      nameLt: 'string',
      nameEn: 'string',

      urlLt: 'string',
      urlEn: 'string',

      visitDuration: {
        type: 'object',
        properties: {
          from: 'number',
          to: 'number',
          isAllDay: 'boolean',
        },
      },

      visitInfo: 'string',

      seasons: {
        type: 'array',
        items: 'string',
      },

      isPaid: 'boolean',
      isAdaptedForForeigners: 'boolean',

      photos: {
        type: 'array',
        columnType: 'json',
        items: { type: 'object' },
      },

      geom: {
        type: 'any',
        geom: {
          properties: ['id'],
        },
      },

      isActive: 'boolean',

      categories: {
        type: 'array',
        items: 'string',
      },
      subCategories: {
        type: 'array',
        items: 'string',
      },
      additionalInfos: {
        type: 'array',
        items: 'string',
      },
      createdAt: { ...COMMON_FIELDS.createdAt },
      deletedAt: { ...COMMON_FIELDS.deletedAt },
    },
    scopes: {
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
  actions: {
    list: {
      auth: EndpointType.PUBLIC,
    },
    get: {
      auth: EndpointType.PUBLIC,
    },
    getTileItems: {
      auth: EndpointType.PUBLIC,
    },
    getTile: {
      auth: EndpointType.PUBLIC,
    },
    find: {
      rest: null,
    },
    count: {
      rest: null,
    },
  },
})
export default class TilesObjectsService extends moleculer.Service {
  @Event()
  async 'cache.clean.tiles.objects'() {
    await this.renewSuperclusterIndex();
  }
}
