USE reporte_detenciones;

ALTER TABLE reportes
  ADD COLUMN imagen_reporte_data LONGTEXT NULL AFTER observacion_general,
  ADD COLUMN imagen_reporte_mime VARCHAR(50) NULL AFTER imagen_reporte_data,
  ADD COLUMN imagen_reporte_nombre VARCHAR(255) NULL AFTER imagen_reporte_mime;
