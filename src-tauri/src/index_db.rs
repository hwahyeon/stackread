//! SQLite index writes.
//!
//! The SQL plugin runs each statement on any connection in its pool, so a
//! BEGIN/COMMIT sent from JS is not reliable. Reads stay in JS; anything that
//! needs a transaction lives here, on the pool the plugin already opened.
//! Plugin migrations are keyed by a connection string known at compile time,
//! but the save root is chosen at runtime, so the schema is versioned here too.

use serde::Deserialize;
use sqlx::{Pool, Sqlite};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

/// One entry per schema version, each a list of single statements.
const MIGRATIONS: &[&[&str]] = &[&[
    "CREATE TABLE articles (
      id            INTEGER PRIMARY KEY,
      title         TEXT NOT NULL,
      author        TEXT,
      published_at  TEXT,
      source_url    TEXT,
      language      TEXT NOT NULL DEFAULT 'en',
      read_at       TEXT NOT NULL,
      folder_path   TEXT NOT NULL UNIQUE
    )",
    "CREATE INDEX idx_articles_read_at ON articles(read_at)",
    "CREATE INDEX idx_articles_language ON articles(language)",
    "CREATE VIRTUAL TABLE articles_fts USING fts5(title, body, tokenize='trigram')",
], &[
    // A JSON array of strings; read with json_each.
    "ALTER TABLE articles ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
]];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewIndexEntry {
    title: String,
    author: String,
    published_at: String,
    source_url: String,
    language: String,
    read_at: String,
    folder_path: String,
    /// A JSON array of strings.
    tags: String,
    body: String,
}

async fn pool(instances: &DbInstances, db: &str) -> Result<Pool<Sqlite>, String> {
    let map = instances.0.read().await;
    match map.get(db) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        None => Err(format!("database is not loaded: {db}")),
    }
}

#[tauri::command]
pub async fn index_migrate(instances: State<'_, DbInstances>, db: String) -> Result<(), String> {
    let pool = pool(instances.inner(), &db).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    for (i, statements) in MIGRATIONS.iter().enumerate().skip(version as usize) {
        for sql in *statements {
            sqlx::query(sql)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("migration {} failed: {e}", i + 1))?;
        }
    }
    let pragma = format!("PRAGMA user_version = {}", MIGRATIONS.len());
    sqlx::query(&pragma)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_update(
    instances: State<'_, DbInstances>,
    db: String,
    id: i64,
    entry: NewIndexEntry,
) -> Result<(), String> {
    let pool = pool(instances.inner(), &db).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let affected = sqlx::query(
        "UPDATE articles SET title = ?, author = ?, published_at = ?, source_url = ?,
           language = ?, read_at = ?, folder_path = ?, tags = ?
         WHERE id = ?",
    )
    .bind(&entry.title)
    .bind(&entry.author)
    .bind(&entry.published_at)
    .bind(&entry.source_url)
    .bind(&entry.language)
    .bind(&entry.read_at)
    .bind(&entry.folder_path)
    .bind(&entry.tags)
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .rows_affected();
    if affected != 1 {
        return Err(format!("article not found in index: {id}"));
    }
    sqlx::query("DELETE FROM articles_fts WHERE rowid = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("INSERT INTO articles_fts (rowid, title, body) VALUES (?, ?, ?)")
        .bind(id)
        .bind(&entry.title)
        .bind(&entry.body)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_delete(
    instances: State<'_, DbInstances>,
    db: String,
    id: i64,
) -> Result<(), String> {
    let pool = pool(instances.inner(), &db).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM articles WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM articles_fts WHERE rowid = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_fill(
    instances: State<'_, DbInstances>,
    db: String,
    entries: Vec<NewIndexEntry>,
) -> Result<(), String> {
    let pool = pool(instances.inner(), &db).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for entry in &entries {
        let id = sqlx::query(
            "INSERT INTO articles
               (title, author, published_at, source_url, language, read_at, folder_path, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry.title)
        .bind(&entry.author)
        .bind(&entry.published_at)
        .bind(&entry.source_url)
        .bind(&entry.language)
        .bind(&entry.read_at)
        .bind(&entry.folder_path)
        .bind(&entry.tags)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .last_insert_rowid();
        sqlx::query("INSERT INTO articles_fts (rowid, title, body) VALUES (?, ?, ?)")
            .bind(id)
            .bind(&entry.title)
            .bind(&entry.body)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_insert(
    instances: State<'_, DbInstances>,
    db: String,
    entry: NewIndexEntry,
) -> Result<i64, String> {
    let pool = pool(instances.inner(), &db).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let id = sqlx::query(
        "INSERT INTO articles
           (title, author, published_at, source_url, language, read_at, folder_path, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&entry.title)
    .bind(&entry.author)
    .bind(&entry.published_at)
    .bind(&entry.source_url)
    .bind(&entry.language)
    .bind(&entry.read_at)
    .bind(&entry.folder_path)
    .bind(&entry.tags)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();
    sqlx::query("INSERT INTO articles_fts (rowid, title, body) VALUES (?, ?, ?)")
        .bind(id)
        .bind(&entry.title)
        .bind(&entry.body)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(id)
}
