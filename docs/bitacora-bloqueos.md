# Bitacora de bloqueos

## Git: `fatal: bad object refs/heads/desktop.ini`

- Contexto: aparece al hacer `git commit` despues de que Git intenta ejecutar el repack geometrico.
- Impacto observado: no impide crear el commit ni hacer `git push` si ambos comandos terminan mostrando el commit y el envio a `origin/main`.
- Accion recomendada: verificar con `git log -1 --oneline`, `git status --short` y confirmar que `git push` haya terminado correctamente antes de investigar mas.
- Estado: bloqueo conocido, no critico para el flujo de despliegue actual.

## PDF en Cloudflare: imagen PNG rompe o demora la descarga

- Contexto: al generar PDF desde Worker con una captura OPINONA PNG grande, el endpoint puede devolver error interno o demorar demasiado si se intenta decodificar/recomprimir la imagen dentro del Worker.
- Impacto observado: el resto del informe queda bloqueado aunque los datos del reporte esten correctos.
- Accion recomendada: mantener el PDF compacto y estable; incrustar solo imagenes compatibles directamente y, si una captura no se puede procesar, continuar generando el PDF con una nota visible de la captura registrada.
- Estado: bloqueo mitigado en el generador PDF para no impedir la descarga del informe.
