-- Etapa 1: contas de usuário e sessões de login.

CREATE TABLE usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 100),
  email         TEXT    NOT NULL COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 254),
  senha_hash    TEXT    NOT NULL,
  perfil        TEXT    NOT NULL DEFAULT 'cliente' CHECK (perfil IN ('cliente')),
  criado_em     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT usuarios_email_unico UNIQUE (email)
);

CREATE TABLE sessoes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash    TEXT    NOT NULL UNIQUE,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criada_em     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em     TEXT    NOT NULL
);

CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);
