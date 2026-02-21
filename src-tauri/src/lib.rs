use tauri::{image::Image, Manager};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use std::sync::Mutex;

struct BackendProcess(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Set window icon from bundled PNG
            let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
                .expect("failed to load icon");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(icon);
            }

            let shell = app.shell();
            let sidecar_command = shell.sidecar("crowforge-backend").unwrap();
            let (_rx, child) = sidecar_command.spawn().unwrap();

            // Store child so it's killed when the app exits
            app.manage(BackendProcess(Mutex::new(Some(child))));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the backend sidecar when the main window closes
                if let Some(state) = window.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
