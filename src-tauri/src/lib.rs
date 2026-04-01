use tauri::{image::Image, Manager};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use std::sync::Mutex;
use std::net::TcpStream;

fn is_backend_running() -> bool {
    TcpStream::connect("127.0.0.1:8000").is_ok()
}

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

#[tauri::command]
async fn restart_backend(
    state: tauri::State<'_, BackendProcess>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    state.kill_inner();
    std::thread::sleep(std::time::Duration::from_millis(500));

    let shell = app.shell();
    let sidecar_command = shell
        .sidecar("crowforge-backend")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?;
    let (_rx, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(child);
    } else {
        return Err("Failed to acquire backend process lock".into());
    }

    Ok(())
}

#[tauri::command]
async fn kill_backend(state: tauri::State<'_, BackendProcess>) -> Result<(), String> {
    state.kill_inner();
    Ok(())
}

#[tauri::command]
async fn start_backend(
    state: tauri::State<'_, BackendProcess>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Don't start if already running
    if let Ok(guard) = state.0.lock() {
        if guard.is_some() {
            return Err("Backend is already running".into());
        }
    }

    let shell = app.shell();
    let sidecar_command = shell
        .sidecar("crowforge-backend")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?;
    let (_rx, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(child);
    } else {
        return Err("Failed to acquire backend process lock".into());
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
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

            // Only spawn sidecar if no backend is already running on port 8000
            // (allows running `python -m backend.app` manually in dev mode)
            let child = if is_backend_running() {
                None
            } else {
                let shell = app.shell();
                let sidecar_command = shell.sidecar("crowforge-backend")
                    .expect("crowforge-backend sidecar not found in bundle");
                let (_rx, c) = sidecar_command.spawn()
                    .expect("failed to spawn crowforge-backend sidecar");
                Some(c)
            };

            app.manage(BackendProcess(Mutex::new(child)));
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                    if let Some(state) = window.try_state::<BackendProcess>() {
                        state.kill_inner();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![restart_backend, kill_backend, start_backend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
