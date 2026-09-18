# Puente local de Verificación Policial

Gestion JD funciona en Vercel y el portal VPA se carga dentro de otro dominio. Por la política de seguridad del navegador, la web no puede escribir directamente dentro de ese iframe. Este puente local conecta Playwright a una ventana de Chrome con depuración remota y completa los datos exportados desde Gestion JD.

## Uso

1. En Gestion JD abrí `Verificaciones policiales`, elegí el auto y completá los datos del titular.
2. Presioná `Preparar precarga`. Se descargará un archivo `verificacion-policial-*.json`.
3. Cerrá las ventanas de Chrome que no quieras exponer al puente y abrí Chrome con depuración remota en el puerto 9222. En Windows, por ejemplo:

   ```powershell
   & "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\gestion-jd-vpa"
   ```

4. Ejecutá desde la raíz del proyecto:

   ```powershell
   npm run police:prefill -- .\verificacion-policial-ABC123.json
   ```

El puente abre el portal, elige `Nuevo trámite` y `Automóviles con dominio`, completa los datos y se detiene para que una persona revise. No resuelve CAPTCHA, no selecciona turnos y no confirma pagos.

Si Chrome usa otro puerto, definí `VPA_CDP_URL`, por ejemplo `http://127.0.0.1:9333`.
