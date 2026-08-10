# launcher-desktop

Cliente de escritorio del ecosistema `multirepo-demo`. Ver
`D:\DMC_Courses\multirepo-demo\CLAUDE.md` para el contexto completo del ecosistema (los otros
repos, el contrato de contenido, la atribución de terceros) y `../registry-api/CLAUDE.md` para el
backend que este repo consume.

## Qué hay

- **Tauri v2** (Rust + WebView2 del sistema), no Electron. Frontend HTML/CSS/JS vanilla, sin
  framework — el mismo criterio de "sin paso de compilación innecesario" que ya usa `registry-api`
  con CommonJS, llevado al frontend nativo.
- **Plugins oficiales de Tauri v2**: `tauri-plugin-global-shortcut` (hotkey global) y
  `tauri-plugin-clipboard-manager` (portapapeles).
- **Ventana única, sin barra de título nativa**: 480x600 fijo, `alwaysOnTop`, arranca oculta,
  vive en la bandeja del sistema (`skipTaskbar: true`). Se muestra/oculta con el atajo global
  (toggle) — nunca se destruye mientras el proceso siga vivo; cerrarla con X/Alt+F4/Esc la oculta,
  no termina la app. Salir de verdad es una acción explícita desde el menú de la bandeja.
- **Dos pestañas, Skills y Prompts**, no dos secciones apiladas con scroll. Con pocos items una
  lista única funcionaba, pero no escala — a 20 skills y 50 prompts, apilado obligaba a scrollear
  para llegar a la segunda sección. Cada pestaña muestra su conteo (`Skills (5)`).
- **Sin sección Harness.** La primera versión tenía una tercera sección con el teaser de
  `gentle-ai`, igual que en `registry-web`. Se sacó a pedido explícito: acá no hay nada para
  copiar ni instalar (es contenido estático, no accionable), y en un launcher pensado para
  velocidad no aporta — esa referencia vive en el sitio web, no hace falta duplicarla acá. Junto
  con la sección se sacó `tauri-plugin-shell` (solo se usaba para abrir ese link).
- **Cliente de `registry-api` en `src/main.js`**: mismo contrato que `registry-web`
  (`GET /items?type=...`, `GET /items/:name`), sin capa de abstracción propia — es un archivo
  chico, no se justifica un `lib/api.js` separado como en el frontend web.

## Decisiones tomadas

- **Paleta y tipografía copiadas 1:1, no reimportadas.** `src/style.css` define los mismos tokens
  de color que `registry-web/src/app/globals.css` (Tailwind v4 vía `@theme`) como variables CSS
  planas — sin Tailwind acá, porque el frontend es vanilla. Si la paleta del AiHub cambia en
  `registry-web`, hay que replicar el cambio a mano en este archivo; no hay una fuente única
  compartida entre ambos repos todavía.
- **Nombre real de los plugins de portapapeles y hotkey**: el brief original asumía
  `clipboard-manager` como nombre probable pero pedía verificarlo. Se confirmó contra el registro
  de npm que los paquetes vigentes de Tauri v2 son `@tauri-apps/plugin-clipboard-manager` y
  `@tauri-apps/plugin-global-shortcut` (crates equivalentes del lado Rust:
  `tauri-plugin-clipboard-manager`, `tauri-plugin-global-shortcut`), ambos en versión `2.3.2` al
  momento de armar este repo. No hubo que ajustar nada respecto al brief.
- **Hotkey fijo en el código, no configurable desde la UI todavía.** `Ctrl+Shift+Space` está
  hardcodeado en `src-tauri/src/lib.rs` (`const HOTKEY`). El brief pedía "configurable" — se
  interpretó como "no hardcodeado de forma irreversible / documentado cómo cambiarlo", no como
  una preferencia con UI y persistencia en disco, que es una feature más grande (necesitaría un
  store de configuración, ej. `tauri-plugin-store`) y quedó fuera del alcance de esta primera
  versión. Documentado como pendiente en el `README.md`.
- **Toggle de ventana, no solo "mostrar"**: el hotkey global esconde la ventana si ya está visible
  en vez de solo traerla al frente — comportamiento estándar de Raycast/Alfred, evita que el
  usuario tenga que buscar el mouse o Esc para cerrarla si ya la tiene abierta.
- **Esconder también al perder foco** (`onFocusChanged`), además de con Esc — mismo motivo:
  un launcher de este tipo se usa como overlay momentáneo, no como ventana persistente.
- **Íconos placeholder generados por script, no arte real.** `src-tauri/icons/` se generó con un
  script de Node ad-hoc (sin dependencias externas, PNG/ICO construidos a mano con `zlib`) para
  que el bundle de Tauri compile sin depender de tener un archivo de diseño real a mano. Son
  funcionales para dev/build pero no son la identidad visual final — reemplazar con
  `npm run tauri icon` cuando exista el arte de marca.
- **Release automatizado con `tauri-apps/tauri-action`** (`.github/workflows/release.yml`), único
  paso manual que quedaba en todo el ecosistema (`registry-api` en Render y `registry-web` en
  Vercel ya redeployan solos en cada push). Se dispara con un tag `vX.Y.Z`, corre en
  `windows-latest` (es la única plataforma que soportamos), y publica el release con los
  instaladores adjuntos. El número de versión hay que bumpearlo a mano en 3 archivos antes de
  taggear (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`) — Tauri no tiene
  una única fuente de verdad para la versión.
- **Version visible en la propia ventana** (`getVersion()` de `@tauri-apps/api/app`, mostrado en
  el footer): sirve como prueba rápida de que una nueva versión instalada es realmente nueva, sin
  tener que ir a buscar el número en ningún otro lado.
- **Gotcha real, no hipotético**: el hotkey global (`Ctrl+Shift+Space`) es exclusivo a nivel de
  sistema operativo — si ya hay una instancia corriendo (instalada o en modo dev) con el hotkey
  registrado, una segunda instancia falla al arrancar con un panic
  (`HotKey already registered`). No es un bug de la app, es el comportamiento esperado de
  `tauri-plugin-global-shortcut`: cerrar la instancia anterior antes de levantar otra.

## Cómo correrlo

Ver `README.md` para el paso a paso completo. Resumen: `registry-api` tiene que estar corriendo
(`cd ../registry-api && npm run dev`, puerto 3000) antes de `npm run tauri dev` acá. Requiere
Rust instalado (`rustup`) además de Node.

## Estructura

```
launcher-desktop/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── src/
│   ├── main.js          # toda la lógica de frontend: fetch, filtro, copiar, toggle de ventana
│   └── style.css         # tokens de color/tipografía del AiHub
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json    # ventana, bundle (nsis/msi), tray icon
    ├── build.rs
    ├── capabilities/
    │   └── default.json   # permisos: clipboard, control de ventana
    ├── icons/              # placeholders generados por script (ver nota en README.md)
    └── src/
        ├── main.rs         # entry point mínimo
        └── lib.rs          # hotkey global, bandeja del sistema, mostrar/ocultar/toggle
```
