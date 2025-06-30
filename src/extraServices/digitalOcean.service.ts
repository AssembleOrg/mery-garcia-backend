import {
  GetObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  PutObjectCommandOutput,
  DeleteObjectCommand,
  S3,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

@Injectable()
export class DigitalOceanService {
  private s3: S3;
  private logger = new Logger('DigitalOceanService');
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const do_access_key = this.configService.get<string>(
      'digitalOcean.do_access_key',
    );
    const do_secret_key = this.configService.get<string>(
      'digitalOcean.do_secret_key',
    );
    const do_spaces_endpoint = this.configService.get<string>(
      'digitalOcean.do_spaces_endpoint',
    );
    const do_region = this.configService.get<string>('digitalOcean.do_region');
    this.bucketName = this.configService.get<string>('digitalOcean.do_bucket_name', 'kansaco-images');

    // Validate required configuration
    if (!do_access_key || !do_secret_key || !do_spaces_endpoint || !do_region) {
      this.logger.error('Missing required DigitalOcean configuration');
      throw new Error('DigitalOcean configuration is incomplete');
    }

    this.s3 = new S3({
      credentials: {
        accessKeyId: do_access_key,
        secretAccessKey: do_secret_key,
      },
      endpoint: do_spaces_endpoint,
      region: do_region,
      forcePathStyle: false, // Required for DigitalOcean Spaces
    });

    this.logger.log(`DigitalOcean service initialized with bucket: ${this.bucketName}`);
  }

  async getFile(fileName: string): Promise<Buffer> {
    try {
      this.logger.debug(`Attempting to get file: ${fileName} from bucket: ${this.bucketName}`);
      
      // 1. Send the command
      const { Body } = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
        }),
      );

      if (!Body) {
        throw new Error(`File ${fileName} not found or empty`);
      }

      // 2. The Body is often a Readable stream
      const stream = Body as Readable;

      // 3. Read all chunks into an array
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }

      // 4. Concatenate to get a single Buffer
      const result = Buffer.concat(chunks);
      this.logger.debug(`Successfully retrieved file: ${fileName}, size: ${result.length} bytes`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting file ${fileName}:`, error);
      throw new Error(`Error getting file from DigitalOcean: ${error.message}`);
    }
  }

  async uploadFile(
    fileName: string,
    fileContent: Buffer,
    contentType?: string,
  ): Promise<PutObjectCommandOutput> {
    try {
      this.logger.debug(`Attempting to upload file: ${fileName} to bucket: ${this.bucketName}`);
      
      const params: any = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileContent,
        ACL: ObjectCannedACL.public_read,
      };

      // Add content type if provided
      if (contentType) {
        params.ContentType = contentType;
      }

      const uploaded = await this.s3.send(new PutObjectCommand(params));
      
      this.logger.debug(`Successfully uploaded file: ${fileName}, size: ${fileContent.length} bytes`);
      return uploaded;
    } catch (error) {
      this.logger.error(`Error uploading file ${fileName}:`, error);
      throw new Error(`Error uploading file to DigitalOcean: ${error.message}`);
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      this.logger.debug(`Attempting to delete file: ${fileName} from bucket: ${this.bucketName}`);
      
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      }));
      
      this.logger.debug(`Successfully deleted file: ${fileName}`);
    } catch (error) {
      this.logger.error(`Error deleting file ${fileName}:`, error);
      throw new Error(`Error deleting file from DigitalOcean: ${error.message}`);
    }
  }

  getFileUrl(fileName: string): string {
    const endpoint = this.configService.get<string>('digitalOcean.do_spaces_endpoint');
    const region = this.configService.get<string>('digitalOcean.do_region');
    
    // Remove https:// from endpoint if present
    const cleanEndpoint = endpoint?.replace('https://', '').replace('http://', '');
    
    return `https://${this.bucketName}.${cleanEndpoint}/${fileName}`;
  }
}
