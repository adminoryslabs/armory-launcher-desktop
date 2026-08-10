// Punto de entrada mínimo: toda la lógica vive en lib.rs para poder
// testearla/reutilizarla (patrón estándar de los templates de Tauri v2).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    launcher_desktop_lib::run();
}
