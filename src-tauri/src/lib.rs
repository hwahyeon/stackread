mod index_db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            index_db::index_migrate,
            index_db::index_insert,
            index_db::index_update,
            index_db::index_delete,
            index_db::index_fill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
