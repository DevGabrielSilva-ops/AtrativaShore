import { Module } from '@nestjs/common';
import { EtiquetasController } from './etiquetas.controller.js';
import { EtiquetasService } from './etiquetas.service.js';

@Module({
  controllers: [EtiquetasController],
  providers: [EtiquetasService],
})
export class EtiquetasModule {}
