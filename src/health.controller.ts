import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  health() { return { status: 'ok', service: 'fintrack-api' }; }

  @Get('ready')
  ready() { return this.database.check(); }
}
