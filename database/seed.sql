USE reporte_detenciones;

INSERT INTO lineas (nombre, activa)
VALUES
  ('Linea 1', 1),
  ('Linea 2', 1),
  ('Linea 3', 1)
ON DUPLICATE KEY UPDATE
  activa = VALUES(activa),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO indicadores (codigo, nombre, color, orden, activo)
VALUES
  ('TC', 'Tiempo de Cambio', '#d9ecfb', 1, 1),
  ('TP', 'Tiempo Planeado', '#e4ebf2', 2, 1),
  ('PV', 'Perdida de Velocidad', '#eadffd', 3, 1),
  ('PE', 'Parada Externa', '#ffe3ca', 4, 1),
  ('DT', 'Disponibilidad Tecnica', '#d9f5e8', 5, 1),
  ('PM', 'Paradas Menores', '#fff2c7', 6, 1),
  ('PC', 'Producto Conforme', '#d7f3ff', 7, 1),
  ('CP', 'Cumplimiento de Programa', '#d8f8de', 8, 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  color = VALUES(color),
  orden = VALUES(orden),
  activo = VALUES(activo),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO turnos (codigo, nombre, activo)
VALUES
  ('A', 'Turno A', 1),
  ('B', 'Turno B', 1),
  ('C', 'Turno C', 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  activo = VALUES(activo),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO turno_horarios (turno_id, dia_semana, hora_inicio, hora_fin, cruza_medianoche, activo)
SELECT t.id, d.dia_semana, '08:10:00', '15:30:00', 0, 1
FROM turnos t
JOIN (
  SELECT 1 AS dia_semana UNION ALL
  SELECT 2 UNION ALL
  SELECT 3 UNION ALL
  SELECT 4 UNION ALL
  SELECT 5
) d
WHERE t.codigo = 'A'
ON DUPLICATE KEY UPDATE
  hora_inicio = VALUES(hora_inicio),
  hora_fin = VALUES(hora_fin),
  cruza_medianoche = VALUES(cruza_medianoche),
  activo = VALUES(activo),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO turno_horarios (turno_id, dia_semana, hora_inicio, hora_fin, cruza_medianoche, activo)
SELECT t.id, 6, '08:10:00', '14:10:00', 0, 1
FROM turnos t
WHERE t.codigo = 'A'
ON DUPLICATE KEY UPDATE
  hora_inicio = VALUES(hora_inicio),
  hora_fin = VALUES(hora_fin),
  cruza_medianoche = VALUES(cruza_medianoche),
  activo = VALUES(activo),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO turno_horarios (turno_id, dia_semana, hora_inicio, hora_fin, cruza_medianoche, activo)
SELECT t.id, d.dia_semana, '15:30:00', '22:50:00', 0, 1
FROM turnos t
JOIN (
  SELECT 1 AS dia_semana UNION ALL
  SELECT 2 UNION ALL
  SELECT 3 UNION ALL
  SELECT 4 UNION ALL
  SELECT 5
) d
WHERE t.codigo = 'B'
ON DUPLICATE KEY UPDATE
  hora_inicio = VALUES(hora_inicio),
  hora_fin = VALUES(hora_fin),
  cruza_medianoche = VALUES(cruza_medianoche),
  activo = VALUES(activo),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO turno_horarios (turno_id, dia_semana, hora_inicio, hora_fin, cruza_medianoche, activo)
SELECT t.id, d.dia_semana, '22:50:00', '08:10:00', 1, 1
FROM turnos t
JOIN (
  SELECT 1 AS dia_semana UNION ALL
  SELECT 2 UNION ALL
  SELECT 3 UNION ALL
  SELECT 4 UNION ALL
  SELECT 5 UNION ALL
  SELECT 6
) d
WHERE t.codigo = 'C'
ON DUPLICATE KEY UPDATE
  hora_inicio = VALUES(hora_inicio),
  hora_fin = VALUES(hora_fin),
  cruza_medianoche = VALUES(cruza_medianoche),
  activo = VALUES(activo),
  updated_at = CURRENT_TIMESTAMP;
