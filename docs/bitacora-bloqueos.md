# Bitacora de bloqueos

## Git: `fatal: bad object refs/heads/desktop.ini`

- Contexto: aparece al hacer `git commit` despues de que Git intenta ejecutar el repack geometrico.
- Impacto observado: no impide crear el commit ni hacer `git push` si ambos comandos terminan mostrando el commit y el envio a `origin/main`.
- Accion recomendada: verificar con `git log -1 --oneline`, `git status --short` y confirmar que `git push` haya terminado correctamente antes de investigar mas.
- Estado: bloqueo conocido, no critico para el flujo de despliegue actual.
