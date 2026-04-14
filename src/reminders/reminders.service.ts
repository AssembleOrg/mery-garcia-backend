import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Client as PgClient } from 'pg';

export interface UpcomingBooking {
  id: string;
  bookingCode: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
  employeeName: string;
  startTime: Date;
  endTime: Date;
}

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private pgClient: PgClient | null = null;

  // Track which booking IDs we've already sent reminders for (reset daily)
  private sentReminders = new Set<string>();

  // Configuration
  private readonly bookingDbUrl: string;
  private readonly whatsappApiUrl: string;
  private readonly sendMessagePassword: string;
  private readonly testMode: boolean;
  private readonly testPhone: string;
  private readonly estilismoCategoryId: string;

  constructor(private readonly configService: ConfigService) {
    this.bookingDbUrl = this.configService.get<string>('BOOKING_DATABASE_URL', '');
    this.whatsappApiUrl = this.configService.get<string>(
      'WHATSAPP_API_URL',
      'http://localhost:3000/whatsapp/send-message',
    );
    this.sendMessagePassword = this.configService.get<string>('SEND_MESSAGE_PASSWORD', '');
    this.testMode = this.configService.get<string>('REMINDER_TEST_MODE', 'false') === 'true';
    this.testPhone = this.configService.get<string>('REMINDER_TEST_PHONE', '5491132013883');
    this.estilismoCategoryId = this.configService.get<string>(
      'ESTILISMO_CATEGORY_ID',
      '316f01a6-ef73-4b05-a322-8da598ba50aa',
    );
  }

  async onModuleInit() {
    if (!this.bookingDbUrl) {
      this.logger.warn('BOOKING_DATABASE_URL not configured. Reminders will not work.');
      return;
    }

    try {
      this.pgClient = new PgClient({ connectionString: this.bookingDbUrl });
      await this.pgClient.connect();
      this.logger.log('✅ Connected to booking database for reminders');

      if (this.testMode) {
        this.logger.warn('🧪 REMINDER TEST MODE ACTIVE — all messages will be sent to: ' + this.testPhone);
      }
    } catch (error) {
      this.logger.error('❌ Failed to connect to booking database:', error.message);
      this.pgClient = null;
    }
  }

  async onModuleDestroy() {
    if (this.pgClient) {
      await this.pgClient.end();
      this.logger.log('Disconnected from booking database');
    }
  }

  /**
   * Run every hour to check for Estilismo bookings in the next 24 hours.
   * Sends WhatsApp reminders via mery-chatbot.
   */
  @Cron('0 * * * *') // Every hour at minute 0
  async handleReminders(): Promise<void> {
    this.logger.log('🔍 Checking for upcoming Estilismo bookings...');

    try {
      const bookings = await this.getUpcomingEstilismoBookings();

      if (bookings.length === 0) {
        this.logger.log('No upcoming Estilismo bookings found for reminders.');
        return;
      }

      this.logger.log(`Found ${bookings.length} upcoming Estilismo booking(s).`);

      let sentCount = 0;
      for (const booking of bookings) {
        // Skip if already sent
        if (this.sentReminders.has(booking.id)) {
          this.logger.debug(`Skipping booking ${booking.bookingCode} — reminder already sent.`);
          continue;
        }

        const phone = this.testMode ? this.testPhone : this.normalizeArgentinePhone(booking.clientPhone);

        if (!phone) {
          this.logger.warn(`Booking ${booking.bookingCode}: No phone number for client ${booking.clientName}`);
          continue;
        }

        const message = this.buildReminderMessage(booking);

        if (this.testMode) {
          this.logger.warn(
            `🧪 TEST MODE: Sending to ${this.testPhone} instead of ${booking.clientPhone} (${booking.clientName})`,
          );
        }

        const success = await this.sendWhatsAppMessage(phone, message);

        if (success) {
          this.sentReminders.add(booking.id);
          sentCount++;
          this.logger.log(
            `✅ Reminder sent for booking ${booking.bookingCode} → ${this.testMode ? this.testPhone : phone} (${booking.clientName})`,
          );
        } else {
          this.logger.error(`❌ Failed to send reminder for booking ${booking.bookingCode}`);
        }

        // Small delay between messages to avoid rate limiting
        await this.sleep(2000);
      }

      this.logger.log(`📨 Reminders sent: ${sentCount}/${bookings.length}`);
    } catch (error) {
      this.logger.error('Error in reminder cron job:', error.message, error.stack);
    }
  }

  /**
   * Reset the sent reminders set daily at midnight
   */
  @Cron('0 0 * * *') // Every day at midnight
  resetSentReminders(): void {
    const count = this.sentReminders.size;
    this.sentReminders.clear();
    this.logger.log(`🔄 Reset sent reminders set (cleared ${count} entries)`);
  }

  /**
   * Query the booking database for confirmed Estilismo bookings
   * happening in the next ~24 hours (23-25 hour window).
   * In test mode, expands to 7 days to find existing bookings.
   */
  async getUpcomingEstilismoBookings(): Promise<UpcomingBooking[]> {
    if (!this.pgClient) {
      this.logger.warn('No database connection. Cannot fetch bookings.');
      return [];
    }

    // In test mode, widen the window to 7 days so we can find existing bookings
    const minHours = this.testMode ? 0 : 23;
    const maxHours = this.testMode ? 168 : 25;

    const query = `
      SELECT 
        b.id,
        b.booking_code AS "bookingCode",
        c.full_name AS "clientName",
        c.phone AS "clientPhone",
        c.email AS "clientEmail",
        s.name AS "serviceName",
        e.full_name AS "employeeName",
        b.start_time AS "startTime",
        b.end_time AS "endTime"
      FROM bookings b
      JOIN clients c ON b.client_id = c.id
      JOIN services s ON b.service_id = s.id
      JOIN employees e ON b.employee_id = e.id
      WHERE s.category_id = $1
        AND b.status = 'CONFIRMED'
        AND b.deleted_at IS NULL
        AND c.phone IS NOT NULL
        AND c.phone != ''
        AND b.start_time BETWEEN NOW() + INTERVAL '${minHours} hours' AND NOW() + INTERVAL '${maxHours} hours'
      ORDER BY b.start_time ASC
    `;

    try {
      const result = await this.pgClient.query(query, [this.estilismoCategoryId]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error querying booking database:', error.message);
      return [];
    }
  }

  /**
   * Build the WhatsApp reminder message
   */
  private buildReminderMessage(booking: UpcomingBooking): string {
    const startTime = new Date(booking.startTime);
    const now = new Date();

    // Format date in Argentina timezone
    const dateStr = startTime.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    const timeStr = startTime.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    // Capitalize first letter of the date
    const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    // Calculate days until the appointment
    const diffHours = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    let whenText: string;
    if (diffHours <= 36) {
      whenText = 'mañana';
    } else if (diffHours <= 60) {
      whenText = 'pasado mañana';
    } else {
      whenText = `el ${formattedDate}`;
    }

    return [
      `📅 *Recordatorio de Turno*`,
      ``,
      `Hola ${booking.clientName}, te recordamos que tenés un turno ${whenText}:`,
      ``,
      `*Servicio:* ${booking.serviceName}`,
      `*Profesional:* ${booking.employeeName}`,
      `*Fecha:* ${formattedDate}`,
      `*Horario:* ${timeStr} hs`,
      ``,
      `Si necesitás cancelar o reprogramar tu turno, podés hacerlo desde acá:`,
      `👉 https://merygarciabooking.com/cambiar-reserva`,
      ``,
      `¡Te esperamos! ✨`,
    ].join('\n');
  }

  /**
   * Send a WhatsApp message via the mery-chatbot API
   */
  private async sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
    if (!this.sendMessagePassword) {
      this.logger.warn('SEND_MESSAGE_PASSWORD not configured. Message not sent.');
      return false;
    }

    try {
      const formData = new FormData();
      formData.append('password', this.sendMessagePassword);
      formData.append('phone', phone);
      formData.append('message', message);

      const response = await fetch(this.whatsappApiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`WhatsApp API error (${response.status}): ${body}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message: ${error.message}`);
      return false;
    }
  }

  /**
   * Normalize an Argentine phone number to WhatsApp format: 549XXXXXXXXXX
   */
  private normalizeArgentinePhone(phone: string): string {
    if (!phone) return '';

    // Clean: remove +, spaces, dashes, parentheses
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

    // Already correct format: 549 + 10 digits = 13 digits
    if (/^549\d{10}$/.test(cleaned)) return cleaned;

    // 54 + 10 digits without the 9 (12 digits) → insert 9
    if (/^54\d{10}$/.test(cleaned)) return '549' + cleaned.slice(2);

    // 0 + 10 digits (local format with 0) → remove 0, add 549
    if (/^0\d{10}$/.test(cleaned)) return '549' + cleaned.slice(1);

    // 10 pure digits (e.g., 1136585581) → add 549
    if (/^\d{10}$/.test(cleaned)) return '549' + cleaned;

    this.logger.warn(`Unrecognized phone format, sending as-is: ${phone}`);
    return cleaned;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
