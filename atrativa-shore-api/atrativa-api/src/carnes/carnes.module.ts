import { Module } from '@nestjs/common';
import { CarnesController } from './carnes.controller.js';
import { CarnesService } from './carnes.service.js';

@Module({
  controllers: [CarnesController],
  providers: [CarnesService],
  exports: [CarnesService],
})
export class CarnesModule {}
