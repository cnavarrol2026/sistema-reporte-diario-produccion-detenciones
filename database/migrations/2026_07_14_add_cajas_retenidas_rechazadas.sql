USE reporte_detenciones;

CREATE TABLE IF NOT EXISTS cajas_retenidas_rechazadas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporte_id BIGINT UNSIGNED NOT NULL,
  turno_id INT UNSIGNED NOT NULL,
  tipo ENUM('retenida', 'rechazada') NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  producto_id VARCHAR(80) NOT NULL,
  producto_nombre VARCHAR(180) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cajas_reporte
    FOREIGN KEY (reporte_id) REFERENCES reportes(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_cajas_turno
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_cajas_reporte (reporte_id),
  INDEX idx_cajas_turno (turno_id),
  INDEX idx_cajas_tipo (tipo)
) ENGINE=InnoDB;
