USE reporte_detenciones;

CREATE TABLE IF NOT EXISTS zonas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO zonas (nombre, activo)
VALUES
  ('Zona 1', 1),
  ('Zona 2', 1),
  ('Zona 3', 1),
  ('Zona 4', 1),
  ('Zona 5', 1),
  ('Transporte General', 1),
  ('Sala de Pulmones', 1)
ON DUPLICATE KEY UPDATE
  activo = VALUES(activo),
  updated_at = CURRENT_TIMESTAMP;

ALTER TABLE detenciones
  ADD COLUMN IF NOT EXISTS zona_id INT UNSIGNED NULL AFTER turno_id;

UPDATE detenciones
SET zona_id = (SELECT id FROM zonas WHERE activo = 1 ORDER BY id LIMIT 1)
WHERE zona_id IS NULL;

ALTER TABLE detenciones
  MODIFY zona_id INT UNSIGNED NOT NULL;

CREATE INDEX IF NOT EXISTS idx_detenciones_zona ON detenciones (zona_id);
