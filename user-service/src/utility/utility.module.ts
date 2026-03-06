import { Module } from '@nestjs/common';
import { UtilityService } from './utility.service';
import { PrismaModule } from '@traeta/prisma';

@Module({
  imports: [PrismaModule],
  providers: [UtilityService],
})
export class UtilityModule {}
