'use strict';
import { FeatureCollection, parse } from 'geojsonjs';
import { every, isArray, isEmpty, isNumber } from 'lodash';
import moleculer, { Context, RestSchema } from 'moleculer';
import { Action, Event, Method, Service } from 'moleculer-decorators';
import PostgisMixin, { GeometryType } from 'moleculer-postgis';
import DbConnection, { MaterializedView } from '../mixins/database.mixin';
//@ts-ignore
import transformation from 'transform-coordinates';
import {
  ALL_FILE_TYPES,
  BaseModelInterface,
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  ContextMeta,
  EndpointType,
  EntityChangedParams,
  FieldHookCallback,
  LKS_SRID,
  TENANT_FIELD,
  throwAlreadyExistError,
  throwBadRequestError,
  throwNotFoundError,
  throwValidationError,
} from '../types';
import { toReadableStream } from '../utils';
import { emailCanBeSent } from '../utils/mails';
import { UserAuthMeta } from './api.service';
import { Category } from './categories.service';
import { FormHistoryTypes } from './forms.histories.service';
import { Tenant } from './tenants.service';
import { User, USERS_DEFAULT_SCOPES, UserType } from './users.service';
import { VisitInfo } from './visitInfos.service';

type FormStatusChanged = { statusChanged: boolean };
type RequestAutoApprove = { autoApprove: boolean };

export const Seasons = {
  WINTER: 'WINTER',
  SUMMER: 'SUMMER',
  SPRING: 'SPRING',
  AUTUMN: 'AUTUMN',
};

export interface Photo {
  url: string;
  name: string;
  author: string;
}

export interface ApiForm {
  externalId: number;
  season: keyof typeof Seasons;
  categories: string[];
  subCategories: string[];
  visitInfo: string;
  description: string;
  name: string;
  descriptionLT: string;
  visitDuration: { from: number; to: number; isAllDay: boolean };
  nameLT: string;
  urlLT: string;
  url: string;
  additionalInfos: string[];
  coordinatesWGS?: number[];
  coordinatesLKS?: number[];
  status: string;
  geom: FeatureCollection;
  isPaid: boolean;
  isAdaptedForForeigners: boolean;
  photos: Photo[];
  isActive?: boolean;
}

export interface Form extends BaseModelInterface {
  id: number;
  externalId: string | number;
  visitTime: { name: string };
  visitInfo: { name: string };
  description: string;
  name: string;
  descriptionLT: string;
  nameLT: string;
  urlLT: string;
  url: string;
  additionalInfos: { name: string }[];
  status: string;
  geom: FeatureCollection;
  isPaid: boolean;
  isAdaptedForForeigners: boolean;
  season: keyof typeof Seasons;
  photos: Photo[];
  isActive: boolean;
  categories: Category[];
  subCategories: Category[];
}

export const FormStatus = {
  CREATED: 'CREATED',
  SUBMITTED: 'SUBMITTED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  APPROVED: 'APPROVED',
};

const VISIBLE_TO_USER_SCOPE = 'visibleToUser';
const urlRegex =
  /^((https?|ftp):\/\/)?(www.)?(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

const importPhotoTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/bmp',
  'image/webp',
  'image/tiff',
];

const AUTH_PROTECTED_SCOPES = [...COMMON_DEFAULT_SCOPES, VISIBLE_TO_USER_SCOPE];

const populatePermissions = (field: string) => {
  return function (ctx: Context<{}, UserAuthMeta>, _values: any, forms: any[]) {
    const { user, profile, authUser } = ctx?.meta;
    return forms.map((form: any) => {
      const editingPermissions = this.hasPermissionToEdit(form, user, authUser, profile);
      return !!editingPermissions[field];
    });
  };
};

async function validateCategories({ value, ctx, params, entity }: FieldHookCallback) {
  if (!value) return;

  const subcategories = params?.subCategories || entity?.subCategories;
  const hasSubcategories = subcategories && subcategories?.length;

  const dbCategories: Category[] = await ctx.call('categories.find', {
    query: {
      ...(hasSubcategories && { parent: { $exists: false } }),
      id: { $in: value },
    },
  });

  const isValid = dbCategories.length === value.length;

  if (!isValid) return throwValidationError('categories are not valid');

  return value;
}

async function validateSubCategories({ params, value, ctx, entity }: FieldHookCallback) {
  if (!value) return;

  const categories = params.categories || entity.categories;

  const dbCategories: Category[] = await ctx.call('categories.resolve', {
    populate: 'children',
    id: categories,
  });

  const childIds: { [key: string]: number } = getCategoryChildIds(dbCategories);

  const isValid = value.every((id: number) => childIds[id]);

  if (!isValid) return throwValidationError('subCategories are not valid');

  return value;
}

const getCategoryChildIds = (categories: Category[]) => {
  return categories.reduce((children, curr): any => {
    if (Array.isArray(curr.children) && curr?.children?.length) {
      return { ...children, ...getCategoryChildIds(curr.children) };
    }

    return { ...children, [curr.id]: 1 };
  }, {});
};

function isUrlLTValid({ value }: FieldHookCallback) {
  if (!value) return;

  if (!urlRegex.test(value)) {
    return throwValidationError('urlLT is not invalid');
  }

  return value;
}

function isUrlValid({ value }: FieldHookCallback) {
  if (!value) return;

  if (!urlRegex.test(value)) {
    return throwValidationError('url is not invalid');
  }

  return value;
}

@Service({
  name: 'forms',

  mixins: [
    DbConnection({
      collection: 'forms',
      entityChangedOldEntity: true,
    }),
    PostgisMixin({
      srid: LKS_SRID,
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
      seasons: {
        type: 'array',
        enum: Object.values(Seasons),
      },
      geom: {
        type: 'any',
        required: true,
        geom: {
          required: true,
          types: [GeometryType.POINT],
        },
      },
      description: 'string',
      externalId: 'string',
      descriptionLT: {
        type: 'string',
        columnType: 'text',
        columnName: 'descriptionLt',
      },

      nameLT: {
        type: 'string',
        required: true,
        columnType: 'text',
        columnName: 'nameLt',
      },
      name: 'string',
      urlLT: {
        type: 'string',
        columnType: 'text',
        columnName: 'urlLt',
        onCreate: isUrlLTValid,
        onUpdate: isUrlLTValid,
        onReplace: isUrlLTValid,
      },

      url: {
        type: 'string',
        onCreate: isUrlValid,
        onUpdate: isUrlValid,
        onReplace: isUrlValid,
      },

      visitDuration: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
          },
          to: {
            type: 'number',
          },
          isAllDay: {
            type: 'boolean',
          },
        },
      },

      visitInfo: {
        type: 'number',
        columnType: 'integer',
        columnName: 'visitInfoId',
        populate: {
          action: 'visitInfos.resolve',
        },
      },

      additionalInfos: {
        type: 'array',
        columnType: 'json',
        items: { type: 'number' },
        populate: {
          action: 'additionalInfos.resolve',
        },
      },

      categories: {
        type: 'array',
        onCreate: validateCategories,
        onUpdate: validateCategories,
        onReplace: validateCategories,
        columnType: 'json',
        required: true,
        items: { type: 'number' },
        populate: {
          action: 'categories.resolve',
        },
      },

      subCategories: {
        type: 'array',
        onCreate: validateSubCategories,
        onUpdate: validateSubCategories,
        onReplace: validateSubCategories,
        columnType: 'json',
        items: { type: 'number' },
        populate: {
          action: 'categories.resolve',
        },
      },

      isPaid: 'boolean',
      isAdaptedForForeigners: 'boolean',
      isActive: {
        type: 'boolean',
        optional: true,
        default: true,
        validate: 'validateIsActive',
      },
      status: {
        type: 'string',
        enum: Object.values(FormStatus),
        validate: 'validateStatus',
        onCreate: function ({ ctx }: FieldHookCallback & ContextMeta<RequestAutoApprove>) {
          const { autoApprove } = ctx?.meta;
          return autoApprove ? FormStatus.APPROVED : FormStatus.CREATED;
        },
        onUpdate: function ({
          ctx,
          value,
          entity,
        }: FieldHookCallback & ContextMeta<FormStatusChanged>) {
          const { user } = ctx?.meta;

          if (!ctx?.meta?.statusChanged || entity?.status === FormStatus.APPROVED) return;
          else if (!user?.id) return value;

          return value || FormStatus.SUBMITTED;
        },
      },

      photos: {
        type: 'array',
        columnType: 'json',
        items: { type: 'object' },
      },
      respondedAt: {
        type: 'date',
        columnType: 'datetime',
        readonly: true,
        set: ({ ctx }: FieldHookCallback & ContextMeta<FormStatusChanged>) => {
          const { user, statusChanged } = ctx?.meta;
          if (user?.type !== UserType.ADMIN || !statusChanged) return;
          return new Date();
        },
      },

      canEdit: {
        type: 'boolean',
        virtual: true,
        populate: populatePermissions('edit'),
      },

      canValidate: {
        type: 'boolean',
        virtual: true,
        populate: populatePermissions('validate'),
      },

      ...TENANT_FIELD,

      ...COMMON_FIELDS,
    },

    scopes: {
      ...COMMON_SCOPES,
      visibleToUser(query: any, ctx: Context<null, UserAuthMeta>, params: any) {
        const { user, profile } = ctx?.meta;
        if (!user?.id) return query;

        const createdByUserQuery = {
          createdBy: user?.id,
          tenant: { $exists: false },
        };

        if (profile?.id) {
          return { ...query, tenant: profile.id };
        } else if (user.type === UserType.USER || query.createdBy === user.id) {
          return { ...query, ...createdByUserQuery };
        }

        return query;
      },
    },

    defaultScopes: AUTH_PROTECTED_SCOPES,
    defaultPopulates: ['geom'],
  },

  hooks: {
    before: {
      create: ['validateStatusChange'],
      update: ['validateStatusChange'],
    },
  },

  actions: {
    update: {
      additionalParams: {
        comment: { type: 'string', optional: true },
      },
    },
  },
})
export default class FormsService extends moleculer.Service {
  @Action({
    rest: <RestSchema>{
      method: 'GET',
      basePath: '/public',
      path: '/forms',
    },
    auth: EndpointType.PUBLIC,
  })
  async publicList(ctx: Context) {
    return ctx.call('tiles.objects.list', ctx.params);
  }

  @Action({
    rest: <RestSchema>{
      method: 'GET',
      basePath: '/public',
      path: '/forms/:id',
    },
    auth: EndpointType.PUBLIC,
    params: {
      id: {
        type: 'number',
        convert: true,
      },
    },
  })
  async publicGetOne(ctx: Context<{ id: string }>) {
    return ctx.call('tiles.objects.get', {
      id: ctx.params.id,
    });
  }

  @Action({
    rest: 'GET /:id/history',
    params: {
      id: {
        type: 'number',
        convert: true,
      },
    },
  })
  async getHistory(
    ctx: Context<{
      id: number;
      page?: number;
      pageSize?: number;
    }>,
  ) {
    return ctx.call(`forms.histories.list`, {
      sort: '-createdAt',
      query: {
        form: ctx.params.id,
      },
      page: ctx.params.page,
      pageSize: ctx.params.pageSize,
      populate: 'createdBy',
    });
  }

  @Action({
    rest: 'PATCH /:id/disable',
    params: {
      id: {
        type: 'number',
        convert: true,
      },
      shouldEnable: {
        type: 'boolean',
        optional: true,
      },
    },
  })
  async formDisable(ctx: Context<{ id: number; shouldEnable?: boolean }, UserAuthMeta>) {
    const form: Form = await ctx.call('forms.resolve', {
      id: ctx.params.id,
      throwIfNotExist: true,
    });

    const isActive = ctx?.params?.shouldEnable || !form?.isActive;

    await this.updateEntity(ctx, {
      id: ctx.params.id,
      isActive,
    });

    return { success: true };
  }

  @Action({
    rest: <RestSchema>{
      method: 'POST',
      path: '/upload',
      type: 'multipart',
      busboyConfig: {
        limits: {
          files: 1,
        },
      },
    },
  })
  async upload(ctx: Context<{}, UserAuthMeta>) {
    const folder = this.getFolderName(ctx.meta?.user, ctx.meta?.profile);
    return ctx.call('minio.uploadFile', {
      payload: ctx.params,
      isPrivate: false,
      types: ALL_FILE_TYPES,
      folder,
    });
  }

  @Action({
    rest: 'POST /external',
    auth: EndpointType.API,
    params: {
      externalId: {
        type: 'string',
        convert: true,
      },
      nameLT: 'string',
      status: {
        type: 'string',
        enum: [FormStatus.CREATED, FormStatus.APPROVED],
        default: FormStatus.APPROVED,
      },
    },
  })
  async createExternalForm(ctx: Context<ApiForm, any>) {
    const params = ctx.params;
    const meta = ctx.meta as any;
    const tenant = meta.tenant;
    ctx.meta.profile = { id: tenant.id };

    ctx.meta.autoApprove = ctx.params.status === FormStatus.APPROVED;

    const form = await ctx.call('forms.findOne', {
      query: { externalId: params.externalId, tenant: tenant.id },
    });

    if (!!form) {
      throwAlreadyExistError('Form already exists');
    }
    const formFields = await this.validateExternalFormFields(ctx, params, tenant);

    await ctx.call('forms.create', formFields);

    return { success: true };
  }

  @Action({
    rest: 'PATCH /external/:externalId',
    auth: EndpointType.API,
    params: {
      externalId: {
        type: 'string',
        convert: true,
      },
    },
  })
  async updateExternalForm(ctx: Context<any>) {
    const params = ctx.params;
    const tenant = (ctx.meta as any)?.tenant;

    const form: Form = await ctx.call('forms.findOne', {
      query: { externalId: params.externalId, tenant: tenant.id },
    });

    if (!form) {
      throwNotFoundError('Form not found');
    }

    const formFields = await this.validateExternalFormFields(ctx, params, tenant);

    await ctx.call('forms.update', {
      id: form.id,
      ...formFields,
    });

    return { success: true };
  }

  @Action({
    rest: 'POST /external/import',
    auth: EndpointType.API,
    params: {
      forms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            externalId: {
              type: 'string',
              convert: true,
            },
            nameLT: 'string',
            status: {
              type: 'string',
              enum: [FormStatus.CREATED, FormStatus.APPROVED],
              default: FormStatus.APPROVED,
            },
          },
        },
      },
    },
  })
  async importExternalForms(ctx: Context<{ forms: ApiForm[] }, any>) {
    const params = ctx.params;
    const forms = params.forms;
    const meta = ctx.meta as any;
    const tenant = meta.tenant;
    ctx.meta.profile = { id: tenant.id };

    const uniqueForms = new Set(forms.map((v) => v.externalId));

    if (uniqueForms.size < forms.length) {
      throwAlreadyExistError('Forms have duplicate externalIds');
    }

    const validForms = await Promise.all(
      params.forms.map(async (form: ApiForm, index: number) => {
        const formPrefix = `Form ${index}.`;

        return await this.validateExternalFormFields(ctx, form, tenant, formPrefix);
      }),
    );
    const adapter = await this.getAdapter(ctx);

    await adapter.removeMany({
      tenantId: tenant.id,
      externalId: { $exists: false },
    });

    for (const form of validForms) {
      const formToUpdate: Form = await ctx.call('forms.findOne', {
        query: { externalId: form.externalId, tenant: tenant.id },
      });

      ctx.meta.autoApprove = form.status === FormStatus.APPROVED;

      if (formToUpdate) {
        await ctx.call('forms.update', {
          id: formToUpdate.id,
          ...form,
        });
      } else {
        await ctx.call('forms.create', form);
      }
    }

    return { success: true };
  }

  @Action({
    rest: 'DELETE /external/:externalId',
    auth: EndpointType.API,
    externalId: {
      type: 'string',
      convert: true,
    },
  })
  async deleteExternalForm(ctx: Context<any>) {
    const params = ctx.params;
    const tenant = (ctx.meta as any)?.tenant;

    const form: Form = await ctx.call('forms.findOne', {
      query: { externalId: params.externalId, tenant: tenant.id },
    });

    if (!form) {
      throwNotFoundError('Form not found');
    }

    await ctx.call('forms.remove', {
      id: form.id,
    });

    return { success: true };
  }

  @Action({ rest: 'GET /external', auth: EndpointType.API })
  async getExternalForms(ctx: Context<any, UserAuthMeta>) {
    const tenant = ctx.meta?.tenant;
    const params = ctx?.params || {};
    const forms: Form = await ctx.call('forms.list', {
      ...params,
      query: { ...(params?.query || {}), tenant: tenant.id },
    });

    return forms;
  }

  @Action({
    rest: 'GET /external/:externalId',
    auth: EndpointType.API,
    externalId: {
      type: 'string',
      convert: true,
    },
  })
  async getExternalForm(ctx: Context<any, UserAuthMeta>) {
    const params = ctx.params || {};
    const tenant = ctx.meta?.tenant;

    const form: Form = await ctx.call('forms.findOne', {
      ...params,
      query: { externalId: params?.externalId, tenant: tenant.id },
    });

    return form;
  }

  @Method
  async validateExternalPhotos(
    photos: Photo[],
    tenant: Tenant,
    ctx: moleculer.Context<ApiForm, {}, moleculer.GenericObject>,
    errorPrefix: string,
  ) {
    const photoBlobs = await Promise.all(
      (photos || []).map(async (photo: Photo, index: number) => {
        const { url, ...rest } = photo;
        const response = await fetch(url);
        const contentType = response.headers.get('content-type');
        const stream = response.body.getReader();

        if (!importPhotoTypes.includes(contentType)) {
          return throwValidationError(`${errorPrefix} Photo ${index} unsupported mimetype`);
        }

        return {
          ...rest,
          contentType,
          stream,
        };
      }),
    );

    const uploadedPhotos = await Promise.all(
      (photoBlobs || []).map(
        async (
          photo: {
            stream: any;
            contentType: string;
            name: string;
            author: string;
          },
          index: number,
        ) => {
          try {
            const { stream, name, author, contentType } = photo;

            const folder = this.getFolderName(undefined, tenant);

            const uploadedPhoto: any = await ctx.call(
              'minio.uploadFile',
              {
                payload: toReadableStream(stream),
                isPrivate: false,
                types: importPhotoTypes,
                folder,
              },
              {
                meta: {
                  mimetype: contentType,
                  filename: name,
                },
              },
            );

            return {
              //If the author is not specified, then set the tenant name as the author
              author: author || tenant.name,
              name: uploadedPhoto?.filename,
              size: uploadedPhoto?.size,
              url: uploadedPhoto?.url,
            };
          } catch (e) {
            return throwValidationError(`${errorPrefix} Photo ${index}. ${e?.type}`);
          }
        },
      ),
    );

    return uploadedPhotos;
  }
  @Method
  async validateExternalMulti(
    ctx: moleculer.Context<ApiForm, {}, moleculer.GenericObject>,
    data: string[],
    service: string,
    errName?: string,
    errorPrefix?: string,
  ) {
    if (isEmpty(data)) return [];

    const dbData: any[] = await ctx.call(`${service}.find`, {
      query: { name: { $in: data } },
    });

    if (dbData.length !== data.length) {
      throwValidationError(`${errorPrefix} Some ${errName || service} do not exist`);
    }

    return dbData.map((item) => item.id);
  }
  @Method
  async validateExternalFormFields(
    ctx: moleculer.Context<any, {}, moleculer.GenericObject>,
    data: ApiForm,
    tenant: Tenant,
    errorPrefix = '',
  ) {
    const {
      categories,
      subCategories,
      additionalInfos,
      visitInfo,
      coordinatesWGS,
      coordinatesLKS,
      photos,
      ...rest
    } = data;

    const newForm: any = { ...rest };

    const coordinatesErr = 'Invalid coordinates';

    if (coordinatesWGS) {
      if (!this.validateCoordinates(coordinatesWGS)) throwBadRequestError(coordinatesErr);

      const transform = transformation('EPSG:4326', '3346');
      const transformed = transform.forward(coordinatesWGS.reverse());
      newForm.geom = this.createPointFeatureCollection(transformed);
    }

    if (coordinatesLKS) {
      if (!this.validateCoordinates(coordinatesLKS)) throwBadRequestError(coordinatesErr);

      newForm.geom = this.createPointFeatureCollection(coordinatesLKS);
    }

    const validateStringsArray = async (
      ctx: moleculer.Context<any, {}, moleculer.GenericObject>,
      array: any[],
      fieldName: string,
      subFieldName = '',
      errorPrefix: string,
    ) => {
      if (!array?.every((i) => typeof i === 'string')) return array || [];

      return await this.validateExternalMulti(ctx, array, fieldName, subFieldName, errorPrefix);
    };

    newForm.categories = await validateStringsArray(ctx, categories, 'categories', '', errorPrefix);

    newForm.subCategories = await validateStringsArray(
      ctx,
      subCategories,
      'categories',
      'subcategories',
      errorPrefix,
    );

    newForm.additionalInfos = await validateStringsArray(
      ctx,
      additionalInfos,
      'additionalInfos',
      '',
      errorPrefix,
    );

    if (typeof visitInfo === 'string') {
      const dbVisitInfo: VisitInfo = await ctx.call(`visitInfos.findOne`, {
        query: { name: visitInfo },
      });

      if (!dbVisitInfo) throwValidationError(`${errorPrefix} Visit info does not exists`);

      newForm.visitInfo = dbVisitInfo.id;
    }

    if (photos) {
      const uploadedPhotos = await this.validateExternalPhotos(photos, tenant, ctx, errorPrefix);
      newForm.photos = uploadedPhotos;
    }

    return newForm;
  }

  @Method
  validateIsActive({ entity }: FieldHookCallback) {
    if (!entity?.id) return true;

    return (
      entity?.status === FormStatus.APPROVED ||
      `Cannot change isActive with status ${entity?.status || 'unknown'}`
    );
  }

  @Method
  validateStatus({ ctx, value, entity }: FieldHookCallback) {
    const { user, profile, authUser } = ctx.meta;

    if (!value) return true;

    const isAdmin = user?.type === UserType.ADMIN;
    const isSuperAdmin = authUser?.type === UserType.SUPER_ADMIN;

    const adminStatuses = [FormStatus.REJECTED, FormStatus.RETURNED, FormStatus.APPROVED];

    const newStatuses = [FormStatus.CREATED, FormStatus.APPROVED];

    const error = `Cannot set status with value ${value}`;

    if (!entity?.id) {
      return newStatuses.includes(value) || error;
    }

    const { edit, validate } = this.hasPermissionToEdit(entity, user, authUser, profile);

    if (edit) {
      return (
        !user?.id ||
        isSuperAdmin ||
        (isAdmin && value === FormStatus.APPROVED) ||
        value === FormStatus.SUBMITTED ||
        error
      );
    } else if (validate) {
      return adminStatuses.includes(value) || error;
    }

    return error;
  }

  @Method
  hasPermissionToEdit(
    form: any,
    user?: User,
    authUser?: User,
    profile?: Tenant,
  ): {
    edit: boolean;
    validate: boolean;
  } {
    const invalid = { edit: false, validate: false };

    if (!form?.id || form.status === FormStatus.REJECTED) {
      return invalid;
    }

    const isSuperAdmin = authUser?.type === UserType.SUPER_ADMIN;
    const tenant = form.tenant || form.tenantId;
    const isCreatedByUser = !tenant && user && user.id === form.createdBy;
    const isCreatedByTenant = profile?.id === tenant;
    const isAdmin = user?.type === UserType.ADMIN;

    if (!user?.id) {
      return { edit: true, validate: true };
    }

    if (isCreatedByUser || isCreatedByTenant) {
      const canEdit = [FormStatus.RETURNED, FormStatus.APPROVED].includes(form.status);
      return { edit: canEdit, validate: false };
    }

    if (isAdmin) {
      const canEdit = isSuperAdmin || form.status === FormStatus.APPROVED;
      const canValidate = [FormStatus.CREATED, FormStatus.SUBMITTED].includes(form.status);
      return { edit: canEdit, validate: canValidate };
    }

    return invalid;
  }

  @Method
  async refreshObjects(ctx: Context) {
    await this.refreshMaterializedView(ctx, MaterializedView.OBJECTS);
    await this.broker.emit('cache.clean.tiles.objects');
  }

  @Method
  async validateStatusChange(
    ctx: Context<
      { id: number; isActive?: boolean },
      UserAuthMeta & RequestAutoApprove & FormStatusChanged
    >,
  ) {
    const { id } = ctx.params;

    const { user } = ctx.meta;
    if (!!id) {
      ctx.meta.statusChanged = true;
    } else if (user?.type === UserType.ADMIN) {
      ctx.meta.autoApprove = true;
      ctx.params.isActive = true;
    }

    return ctx;
  }

  @Method
  createFormHistory(ctx: Context, id: number, type: string, comment: string = '') {
    return ctx.call('forms.histories.create', {
      form: id,
      comment,
      type,
    });
  }

  @Method
  getFolderName(user?: User, tenant?: Tenant) {
    const tenantPath = tenant?.id || 'private';
    const userPath = user?.id || 'user';

    return `uploads/forms/${tenantPath}/${userPath}`;
  }

  @Method
  validateCoordinates(coordinates: number[]) {
    return (
      isArray(coordinates) &&
      coordinates.length === 2 &&
      every(coordinates, (num) => isNumber(num) && !isNaN(num))
    );
  }

  @Method
  createPointFeatureCollection(coordinates: number[]) {
    return parse({
      type: 'Point',
      coordinates,
    });
  }

  @Method
  async sendNotificationOnStatusChange(form: Form) {
    // TODO: send email for admins.
    if (!emailCanBeSent() || [FormStatus.CREATED, FormStatus.SUBMITTED].includes(form?.status)) {
      return;
    }

    const user: User = await this.broker.call('users.resolve', {
      id: form.createdBy,
      scope: USERS_DEFAULT_SCOPES,
    });

    // notifyOnFormUpdate(
    //   user.email,
    //   form.status,
    //   form.id,
    //   form.type,
    //   object.name,
    //   object.id,
    //   user.type === UserType.ADMIN
    // );
  }

  @Event()
  async 'forms.updated'(ctx: Context<EntityChangedParams<Form>>) {
    const { oldData: prevForm, data: form } = ctx.params;

    if (prevForm?.status === FormStatus.APPROVED) {
      await this.createFormHistory(ctx, form.id, FormHistoryTypes.UPDATED);
      await this.refreshObjects(ctx);
    } else if (prevForm?.status !== form?.status) {
      const { comment } = ctx.options?.parentCtx?.params as any;
      const typesByStatus = {
        [FormStatus.SUBMITTED]: FormHistoryTypes.UPDATED,
        [FormStatus.REJECTED]: FormHistoryTypes.REJECTED,
        [FormStatus.RETURNED]: FormHistoryTypes.RETURNED,
        [FormStatus.APPROVED]: FormHistoryTypes.APPROVED,
      };

      if (form?.status === FormStatus.APPROVED) {
        await this.refreshObjects(ctx);
      }

      await this.createFormHistory(ctx, form.id, typesByStatus[form?.status], comment);
    }
  }

  @Event()
  async 'forms.created'(ctx: Context<EntityChangedParams<Form[]>, RequestAutoApprove>) {
    const { data } = ctx.params;

    const forms = Array.isArray(data) ? data : [data];
    const autoApprove = ctx?.meta?.autoApprove;

    await Promise.all(
      forms.map(async (form) => {
        await this.createFormHistory(
          ctx,
          form.id,
          autoApprove ? FormHistoryTypes.APPROVED : FormHistoryTypes.CREATED,
        );

        if (!autoApprove) {
          await this.sendNotificationOnStatusChange(form);
        }
      }),
    );

    if (autoApprove) {
      await this.refreshObjects(ctx);
    }
  }

  @Event()
  async 'forms.removed'(ctx: Context<EntityChangedParams<Form>>) {
    await this.refreshObjects(ctx);
  }
}
