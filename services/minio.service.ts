'use strict';
import Moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
// @ts-ignore
import MinioMixin from 'moleculer-minio';
import moment from 'moment';
import {
  EndpointType,
  getExtention,
  getMimetype,
  getPublicFileName,
  IMAGE_TYPES,
  MultipartMeta,
  throwNotFoundError,
  throwUnableToUploadError,
  throwUnsupportedMimetypeError,
} from '../types';
import { UserAuthMeta } from './api.service';

export const BUCKET_NAME = () => process.env.MINIO_BUCKET || 'tip';

@Service({
  name: 'minio',
  mixins: [MinioMixin],
  settings: {
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USESSL === 'true',
    accessKey: process.env.MINIO_ACCESSKEY,
    secretKey: process.env.MINIO_SECRETKEY,
  },
})
export default class MinioService extends Moleculer.Service {
  @Action({
    params: {
      bucketName: {
        type: 'string',
        optional: true,
        default: BUCKET_NAME(),
      },
      objectName: 'string',
      isPrivate: {
        type: 'boolean',
        default: false,
      },
    },
  })
  getUrl(
    ctx: Context<{
      bucketName: string;
      objectName: string;
      isPrivate?: boolean;
    }>,
  ) {
    const { bucketName, objectName, isPrivate } = ctx.params;

    return this.getObjectUrl(objectName, isPrivate, bucketName);
  }

  @Action({
    params: {
      folder: 'string',
      types: {
        type: 'array',
        items: 'string',
        optional: true,
        default: IMAGE_TYPES,
      },
      name: {
        type: 'string',
        optional: true,
      },
      isPrivate: {
        type: 'boolean',
        default: false,
      },
      presign: {
        type: 'boolean',
        default: false,
      },
    },
    timeout: 0,
  })
  async uploadFile(
    ctx: Context<
      {
        payload: NodeJS.ReadableStream;
        folder: string;
        types: string[];
        name: string;
        presign?: boolean;
        isPrivate?: boolean;
      },
      UserAuthMeta & MultipartMeta & { protected?: boolean }
    >,
  ) {
    const { mimetype, filename } = ctx.meta;
    const { folder, payload, types, isPrivate, name: defaultName, presign } = ctx.params;
    const name = defaultName || getPublicFileName(50);

    if (!types.includes(mimetype)) {
      throwUnsupportedMimetypeError();
    }

    const extension = getExtention(mimetype);

    const objectFileName = `${folder}/${name}.${extension}`;
    const bucketName = BUCKET_NAME();

    try {
      await ctx.call('minio.putObject', payload, {
        meta: {
          bucketName,
          objectName: objectFileName,
          metaData: {
            'Content-Type': mimetype,
          },
        },
      });
    } catch (_e) {
      throwUnableToUploadError();
    }

    const { size }: { size: number } = await ctx.call('minio.statObject', {
      objectName: objectFileName,
      bucketName,
    });

    const url = await ctx.call('minio.getUrl', {
      objectName: objectFileName,
      isPrivate,
      bucketName,
    });

    const response: any = {
      success: true,
      url,
      size,
      filename,
      path: `${bucketName}/${objectFileName}`,
    };

    if (presign) {
      const presignedUrl: string = await this.getPresignedUrl(ctx, objectFileName, bucketName);
      response.presignedUrl = presignedUrl;
    }

    return response;
  }

  @Action({
    params: {
      path: 'string',
    },
  })
  async listFiles(ctx: Context<{ path: string }>) {
    const hostUrl = process.env.MINIO_PUBLIC_URL;
    const bucketName = BUCKET_NAME();

    const { path } = ctx.params;

    try {
      const objects: any = await ctx.call('minio.listObjects', {
        bucketName: bucketName,
        prefix: path,
        recursive: true,
      });

      const fileList: string[] = [];

      for await (const obj of objects) {
        if (obj.name) {
          fileList.push(`${hostUrl}/${bucketName}/${obj.name}`);
        }
      }

      return fileList;
    } catch (err) {
      return throwNotFoundError('Folder not found.');
    }
  }

  @Action({
    params: {
      name: {
        type: 'array',
        items: {
          type: 'string',
          convert: true,
        },
      },
    },
    auth: EndpointType.PUBLIC,
    rest: 'GET /:bucket/:name+',
  })
  async getFile(
    ctx: Context<
      { bucket: string; name: string[] },
      {
        $responseHeaders: any;
        $statusCode: number;
        $statusMessage: string;
        $responseType: string;
      }
    >,
  ) {
    const { bucket, name } = ctx.params;

    try {
      const reader: NodeJS.ReadableStream = await ctx.call('minio.getObject', {
        bucketName: bucket,
        objectName: name.join('/'),
      });

      const filename = name[name.length - 1];
      const mimetype = getMimetype(filename);
      if (mimetype) {
        ctx.meta.$responseType = mimetype;
      }

      return reader;
    } catch (err) {
      return throwNotFoundError('File not found.');
    }
  }

  @Action({
    params: {
      objectName: 'string',
      bucketName: {
        type: 'string',
        default: BUCKET_NAME(),
      },
    },
  })
  async fileStat(ctx: Context<{ bucketName: string; objectName: string }>) {
    const { bucketName, objectName } = ctx.params;

    const response: any = {
      exists: false,
    };
    try {
      const data: any = await ctx.call('minio.statObject', {
        bucketName,
        objectName,
      });

      response.exists = data?.size > 0;

      if (response.exists) {
        const presignedUrl: string = await this.getPresignedUrl(ctx, objectName, bucketName);

        response.publicUrl = this.getObjectUrl(objectName, false, bucketName);
        response.privateUrl = this.getObjectUrl(objectName, true, bucketName);
        response.presignedUrl = presignedUrl;
        response.lastModified = moment(data.lastModified).format();
      }

      return response;
    } catch (err) {}

    return response;
  }

  @Action({
    params: {
      path: 'string',
    },
  })
  async removeFile(ctx: Context<{ path: string }>) {
    const { path } = ctx.params;

    const [bucket, ...paths] = path.split('/');

    try {
      const result = await ctx.call('minio.removeObject', {
        bucketName: bucket,
        objectName: paths.join('/'),
      });
      return { sucess: !result };
    } catch (err) {
      return { succes: false };
    }
  }

  async started() {
    try {
      const bucketExists: boolean = await this.actions.bucketExists({
        bucketName: BUCKET_NAME(),
      });

      if (!bucketExists) {
        await this.actions.makeBucket({
          bucketName: BUCKET_NAME(),
        });
      }

      await this.client.setBucketPolicy(
        BUCKET_NAME(),
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                AWS: ['*'],
              },
              Action: ['s3:GetObject'],
              Resource: [
                `arn:aws:s3:::${BUCKET_NAME()}/uploads/icons/*`,
                `arn:aws:s3:::${BUCKET_NAME()}/uploads/forms/*`,
              ],
            },
          ],
        }),
      );
    } catch (err) {
      this.broker.logger.fatal(err);
    }
  }

  @Method
  getObjectUrl(objectName: string, isPrivate: boolean = false, bucketName: string = BUCKET_NAME()) {
    let hostUrl = process.env.MINIO_PUBLIC_URL;

    if (isPrivate) {
      hostUrl = `${process.env.SERVER_HOST}/minio`;
    }

    return `${hostUrl}/${bucketName}/${objectName}`;
  }

  @Method
  getPresignedUrl(
    ctx: Context,
    objectName: string,
    bucketName: string = BUCKET_NAME(),
  ): Promise<string> {
    return ctx.call('minio.presignedUrl', {
      bucketName,
      objectName,
      httpMethod: 'GET',
      expires: 60 * 60 * 24 * 7, // 1 week
      reqParams: {},
      requestDate: moment().format(),
    });
  }

  created() {
    if (!process.env.MINIO_ACCESSKEY || !process.env.MINIO_SECRETKEY) {
      this.broker.fatal('MINIO is not configured');
    }
  }
}
