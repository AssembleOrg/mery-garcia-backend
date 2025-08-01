/* import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from '../supabase.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  public supabase: SupabaseClient<Database>;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey = this.configService.get<string>('supabase.key');

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async verifyToken(token: string): Promise<{
    user: User;
  }> {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error) {
      this.logger.error(error);
      throw new BadRequestException(error.toString());
    }

    if (data.user === null) {
      throw new BadRequestException('Token no valido');
    }

    return data;
  }
}
 */