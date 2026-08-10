use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const MAIN_WINDOW_LABEL: &str = "main";
const HOTKEY: Modifiers = Modifiers::CONTROL.union(Modifiers::SHIFT);

/// Muestra la ventana principal, la centra, la trae al frente y le da foco
/// al buscador (vía el evento "launcher-shown" que escucha el frontend).
fn show_launcher(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("launcher-shown", ());
    }
}

fn hide_launcher(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

/// Toggle: si la ventana está visible la esconde, si no la muestra.
/// Es el comportamiento estándar de launchers tipo Raycast/Alfred.
fn toggle_launcher(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        match window.is_visible() {
            Ok(true) => hide_launcher(app),
            _ => show_launcher(app),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    let toggle_shortcut = Shortcut::new(Some(HOTKEY), Code::Space);
                    if shortcut == &toggle_shortcut && event.state() == ShortcutState::Pressed {
                        toggle_launcher(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Hotkey global por defecto: Ctrl+Shift+Space.
            let toggle_shortcut = Shortcut::new(Some(HOTKEY), Code::Space);
            app.global_shortcut().register(toggle_shortcut)?;

            // Bandeja del sistema: click izquierdo togglea, menú con Mostrar/Salir.
            let show_item = MenuItem::with_id(app, "show", "Mostrar launcher", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("Armory Launcher")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_launcher(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_launcher(tray.app_handle());
                    }
                })
                .build(app)?;

            // Arranca escondida: sigue viva en bandeja, no aparece en la barra de tareas.
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let _ = window.hide();
            }

            Ok(())
        })
        // Cerrar la ventana (X, Alt+F4) la esconde en vez de destruir el proceso:
        // el launcher sigue vivo en la bandeja hasta "Salir" desde el tray.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW_LABEL {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación de Tauri");
}
