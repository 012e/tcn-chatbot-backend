create table documents (
    id integer primary key autoincrement,
    content text not null,
    created_at timestamp not null default current_timestamp,
    updated_at timestamp not null default current_timestamp
);

create table document_chunks (
    id integer primary key autoincrement,
    document_id integer not null references documents(id) on delete cascade,
    chunk text not null,
    metadata text,
    embedding f32_blob(1024) not null
);

create index idx_document_chunks_document_id on document_chunks (document_id);

create index idx_document_chunks_embedding on document_chunks (libsql_vector_idx(embedding));

