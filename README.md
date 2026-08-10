# launcher-desktop

Aplicación de escritorio nativa (Windows) del ecosistema `multirepo-demo`. Es un launcher tipo
Raycast/Alfred: se activa con un atajo de teclado global, busca skills y prompts del catálogo de
`adminoryslabs-skills` (servido por `registry-api`) y copia al portapapeles lo necesario para
usarlos, sin salir del editor o la terminal donde se esté trabajando.

Ver `D:\DMC_Courses\multirepo-demo\CLAUDE.md` para el contexto completo del ecosistema y
`../registry-api/README.md` para el backend que esta aplicación consume.

## Qué hace

- Se activa y se oculta con un atajo de teclado global (por defecto `Ctrl+Shift+Space`,
  configurable — ver más abajo).
- Buscador con filtro en vivo sobre dos listas: **Skills** y **Prompts**, obtenidas de
  `registry-api` (`GET /items?type=skill` y `GET /items?type=prompt`).
- Click o Enter sobre una fila de **Skill** copia al portapapeles el comando de instalación:
  `npx skills add adminoryslabs/Skills --skill <nombre>`.
- Click o Enter sobre una fila de **Prompt** pide el detalle (`GET /items/:name`) y copia el
  cuerpo completo (`body`) al portapapeles.
- Botón de refresh: vuelve a pedir `/items` y actualiza las listas de Skills y Prompts.
- Vive en la bandeja del sistema: al cerrar la ventana (X, Alt+F4 o Esc) se oculta, no termina el
  proceso. Para salir de verdad, usar "Salir" desde el ícono de la bandeja.

## Requisitos

- Windows 10/11 con WebView2 (viene preinstalado en Windows 10 2004+ y Windows 11).
- [Node.js](https://nodejs.org/) 18 o superior.
- [Rust](https://www.rust-lang.org/tools/install) (toolchain estable, `x86_64-pc-windows-msvc`) —
  necesario porque Tauri compila un binario nativo. Se instala con `rustup`.
- `registry-api` corriendo (ver `../registry-api/README.md`) — sin el backend disponible, las
  secciones Skills y Prompts muestran un estado de error, pero la aplicación igual abre.

## Cómo levantarlo en desarrollo

```bash
# 1. Instalar dependencias de Node
npm install

# 2. Configurar la URL del API (opcional, el default ya sirve en local)
cp .env.example .env

# 3. Levantar registry-api en otra terminal (puerto 3000)
cd ../registry-api && npm run dev

# 4. Arrancar el launcher en modo desarrollo
npm run tauri dev
```

La primera compilación de Rust puede tardar varios minutos (descarga y compila todas las
dependencias nativas). Las siguientes son incrementales y mucho más rápidas.

En desarrollo la ventana no arranca oculta automáticamente en bandeja de la misma forma que en
producción empaquetada — usar el atajo global o el ícono de la bandeja para mostrarla/ocultarla en
cualquier momento.

## Cómo generar el instalable

**Automático (recomendado)**: pushear un tag `vX.Y.Z` dispara
`.github/workflows/release.yml`, que compila y publica un GitHub Release con los instaladores
adjuntos.

```bash
# 1. Bump de version en los 3 lugares donde Tauri la necesita consistente:
#    package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
# 2. Commit y push a main
git push origin main

# 3. Tag y push del tag — esto dispara el workflow
git tag v0.2.0
git push origin v0.2.0
```

El release en `https://github.com/adminoryslabs/armory-launcher-desktop/releases/latest` se
actualiza solo — es el mismo link que usa el botón de descarga en el sitio web, así que nunca hay
que actualizar ese link a mano.

**Manual (para probar local antes de taggear)**:

```bash
npm run tauri build
```

Genera el instalable en `src-tauri/target/release/bundle/` (formatos `nsis` y `msi` para Windows,
configurados en `src-tauri/tauri.conf.json`).

## Configuración

### URL del backend (`registry-api`)

La URL base es configurable, no está hardcodeada. Se lee de la variable de entorno
`VITE_API_BASE_URL` en tiempo de build del frontend (ver `.env.example`). Si no se define, el
default es `http://localhost:3000`.

```bash
# .env
VITE_API_BASE_URL=https://registry-api-production.onrender.com
```

Al cambiar esta variable hace falta recompilar el frontend (`npm run tauri dev` o
`npm run tauri build` de nuevo) — es una variable de build de Vite, no se lee en runtime desde un
archivo de configuración del usuario.

### Atajo de teclado global

El atajo por defecto es `Ctrl+Shift+Space`, definido en `src-tauri/src/lib.rs` (constante
`HOTKEY` + `Code::Space`). Hoy es un valor fijo en el código fuente, no una preferencia editable
desde la interfaz — cambiarlo requiere editar ese archivo y recompilar. Dejar el atajo
configurable desde la UI (con persistencia en disco) queda como trabajo futuro.

## Estructura

```
launcher-desktop/
├── index.html              # shell de la ventana (buscador, pestañas Skills/Prompts)
├── src/
│   ├── main.js              # fetch a registry-api, filtro en vivo, copiar al portapapeles,
│   │                         # toggle de ventana, cambio de pestaña
│   └── style.css            # tokens de color/tipografía del AiHub (idénticos a registry-web)
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json      # ventana (480x600, sin título, alwaysOnTop, oculta al arrancar)
│   ├── capabilities/
│   │   └── default.json     # permisos: portapapeles, control de ventana
│   ├── icons/                # íconos del bundle (placeholders, ver nota abajo)
│   └── src/
│       ├── main.rs
│       └── lib.rs           # hotkey global, bandeja del sistema, mostrar/ocultar ventana
├── .env.example
└── package.json
```

## Nota sobre los íconos

Los archivos en `src-tauri/icons/` son placeholders generados programáticamente (fondo del tema,
glifo genérico en el color de acento) para que el bundle compile sin depender de un archivo de
arte externo. Todavía usan la identidad visual vieja (previa al rename a Armory) — reemplazarlos
con `npm run tauri icon <ruta-a-un-png-o-svg-de-al-menos-1024x1024>` cuando exista el arte de marca
definitivo de Armory.
