import { Controller, Get, Post, Query, Logger, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RemindersService, UpcomingBooking } from './reminders.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('reminders')
@Controller('reminders')
export class RemindersController {
  private readonly logger = new Logger(RemindersController.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates the password query param for endpoints that don't use JWT.
   * Uses the same SEND_MESSAGE_PASSWORD as the chatbot.
   */
  private validatePassword(password?: string): void {
    const required = this.configService.get<string>('SEND_MESSAGE_PASSWORD', '');
    if (!required || !password || password !== required) {
      throw new UnauthorizedException('Password inválido');
    }
  }

  @Post('test')
  @ApiOperation({
    summary: 'Disparar recordatorios manualmente (test)',
    description:
      'Ejecuta el cron de recordatorios inmediatamente. Requiere password como query param.',
  })
  @ApiQuery({ name: 'password', required: true, type: String, description: 'SEND_MESSAGE_PASSWORD' })
  @ApiResponse({ status: 200, description: 'Recordatorios procesados' })
  @ApiResponse({ status: 401, description: 'Password inválido' })
  async triggerReminders(
    @Query('password') password?: string,
  ): Promise<{ message: string; timestamp: string }> {
    this.validatePassword(password);
    this.logger.log('🧪 Manual trigger of reminders cron job');
    await this.remindersService.handleReminders();
    return {
      message: 'Reminders cron executed successfully. Check server logs for details.',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('upcoming')
  @ApiOperation({
    summary: 'Ver próximos turnos de Estilismo con recordatorio pendiente',
    description:
      'Lista los turnos de Estilismo que recibirán recordatorio. Requiere password como query param.',
  })
  @ApiQuery({ name: 'password', required: true, type: String, description: 'SEND_MESSAGE_PASSWORD' })
  @ApiResponse({ status: 200, description: 'Lista de turnos próximos' })
  @ApiResponse({ status: 401, description: 'Password inválido' })
  async getUpcoming(
    @Query('password') password?: string,
  ): Promise<{
    total: number;
    testMode: boolean;
    bookings: UpcomingBooking[];
  }> {
    this.validatePassword(password);
    const bookings = await this.remindersService.getUpcomingEstilismoBookings();
    return {
      total: bookings.length,
      testMode: process.env.REMINDER_TEST_MODE === 'true',
      bookings,
    };
  }
}
