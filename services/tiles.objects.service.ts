'use strict';

import { TilesMixin } from '@aplinkosministerija/moleculer-accounts';
import moleculer from 'moleculer';
import { Event, Service } from 'moleculer-decorators';
import config from '../knexfile';
import { MaterializedView } from '../mixins/database.mixin';
import QueryJsonMixin from '../mixins/queryJson.mixin';
import { COMMON_FIELDS, EndpointType, LKS_SRID } from '../types';

const isLocalDevelopment = process.env.NODE_ENV === 'local';

@Service({
  name: 'tiles.objects',
  mixins: [
    QueryJsonMixin(),
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

      visitInfo: {
        type: 'object',
        properties: {
          id: 'number',
          name: 'string',
          nameEn: 'string',
        },
      },

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
        items: {
          type: 'object',
          properties: {
            id: 'number',
            name: 'string',
            nameEn: 'string',
          },
        },
      },
      subCategories: {
        type: 'array',
        items: 'object',
        properties: {
          id: 'number',
          name: 'string',
          nameEn: 'string',
        },
      },
      additionalInfos: {
        type: 'array',
        items: 'object',
        properties: {
          id: 'number',
          name: 'string',
          nameEn: 'string',
          icon: 'string',
        },
      },
      tenant: {
        type: 'object',
        properties: {
          id: 'number',
          name: 'string',
          code: 'string',
        },
      },
      createdAt: { ...COMMON_FIELDS.createdAt },
    },
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
