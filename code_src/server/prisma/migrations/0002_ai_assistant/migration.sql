CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  role_scope TEXT NOT NULL CHECK (role_scope IN ('visitor', 'admin')),
  content_id TEXT,
  content_type TEXT CHECK (content_type IN ('article', 'project')),
  title TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
  body TEXT NOT NULL,
  token_usage INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

CREATE TABLE ai_uploaded_files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  storage_path TEXT NOT NULL,
  parsed_text TEXT NOT NULL,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_generations (
  id TEXT PRIMARY KEY,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('article', 'project', 'analysis', 'rewrite')),
  source_file_id TEXT,
  source_content_id TEXT,
  prompt TEXT NOT NULL,
  result_json TEXT NOT NULL,
  target_content_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'saved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_file_id) REFERENCES ai_uploaded_files(id) ON DELETE SET NULL
);

CREATE INDEX idx_ai_conversations_scope_updated ON ai_conversations(role_scope, updated_at DESC);
CREATE INDEX idx_ai_conversations_content ON ai_conversations(content_type, content_id);
CREATE INDEX idx_ai_messages_conversation_created ON ai_messages(conversation_id, created_at ASC);
CREATE INDEX idx_ai_uploaded_files_status_created ON ai_uploaded_files(parse_status, created_at DESC);
CREATE INDEX idx_ai_generations_type_status_created ON ai_generations(generation_type, status, created_at DESC);
CREATE INDEX idx_ai_generations_source_content ON ai_generations(source_content_id);
CREATE INDEX idx_ai_generations_target_content ON ai_generations(target_content_id);
