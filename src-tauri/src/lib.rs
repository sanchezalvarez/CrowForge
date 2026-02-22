use tauri::{image::Image, Manager};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use std::sync::Mutex;

struct BackendProcess(Mutex<Option<CommandChild>>);

impl BackendProcess {
    fn kill_inner(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        self.kill_inner();
    }
}

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
            let sidecar_command = shell.sidecar("crowforge-backend")
                .expect("crowforge-backend sidecar not found in bundle");
            let (_rx, child) = sidecar_command.spawn()
                .expect("failed to spawn crowforge-backend sidecar");

            // Store child — Drop impl will kill it when Tauri exits for any reason
            app.manage(BackendProcess(Mutex::new(Some(child))));
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                // CloseRequested fires before the window closes — most reliable on Windows
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                    if let Some(state) = window.try_state::<BackendProcess>() {
                        state.kill_inner();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
