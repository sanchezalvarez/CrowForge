use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri::image::Image;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Set window icon from bundled PNG
            let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
                .expect("failed to load icon");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(icon);
            }

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                run_installation(handle);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running installer");
}

fn run_installation(app: AppHandle) {
    // Small delay so splash renders first
    std::thread::sleep(Duration::from_millis(500));

    emit_progress(&app, 10, "Extracting installer...");

    // Extract embedded NSIS installer to temp dir
    let temp_dir = std::env::temp_dir().join("crowforge_install");
    std::fs::create_dir_all(&temp_dir).ok();
    let setup_path = temp_dir.join("crowforge-setup.exe");

    // Skip extraction if temp file already exists with correct size
    let setup_bytes = include_bytes!("../../crowforge-setup.exe");
    let needs_extract = match std::fs::metadata(&setup_path) {
        Ok(meta) => meta.len() != setup_bytes.len() as u64,
        Err(_) => true,
    };

    if needs_extract {
        if let Err(e) = std::fs::write(&setup_path, setup_bytes) {
            app.emit("install-error", format!("Failed to extract installer: {}", e)).ok();
            return;
        }
    }

    emit_progress(&app, 25, "Closing running instances...");

    // Kill running CrowForge processes so NSIS can overwrite locked files
    Command::new("taskkill").args(["/F", "/IM", "CrowForge.exe"]).output().ok();
    Command::new("taskkill").args(["/F", "/IM", "crowforge-backend.exe"]).output().ok();
    std::thread::sleep(Duration::from_millis(500));

    emit_progress(&app, 35, "Installing CrowForge...");

    // Run NSIS silently
    let install_dir = get_install_dir();
    let status = Command::new(&setup_path)
        .arg("/S")
        .arg("/CURRENTUSER")
        .arg(format!("/D={}", install_dir.display()))
        .status();

    // Always clean up temp file
    std::fs::remove_file(&setup_path).ok();
    std::fs::remove_dir(&temp_dir).ok();

    match status {
        Ok(exit) if exit.success() => {
            emit_progress(&app, 90, "Finalizing...");
            std::thread::sleep(Duration::from_millis(600));

            emit_progress(&app, 100, "Done! Starting CrowForge...");
            app.emit("install-complete", ()).ok();

            std::thread::sleep(Duration::from_millis(1200));

            let exe = install_dir.join("CrowForge.exe");
            if exe.exists() {
                Command::new(exe).spawn().ok();
            }

            app.exit(0);
        }
        Ok(exit) => {
            let msg = format!("Installer exited with code {}", exit.code().unwrap_or(-1));
            app.emit("install-error", msg).ok();
        }
        Err(e) => {
            app.emit("install-error", e.to_string()).ok();
        }
    }
}

fn emit_progress(app: &AppHandle, percent: u32, message: &str) {
    app.emit("install-progress", serde_json::json!({
        "percent": percent,
        "message": message
    })).ok();
}

fn get_install_dir() -> PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| "C:\\Users\\Public".to_string());
    PathBuf::from(local_app_data).join("CrowForge")
}
