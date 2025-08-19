create table configurations (
    name text primary key,
    value text,
    type text not null check (type in ('string', 'integer', 'boolean', 'blob', 'json')),
    description text not null
);


insert into configurations (name, value, type, description) values
    ('bot_profile_picture', NULL, 'blob', 'Ảnh đại diện của bot'),
    ('chat_bubble_picture', NULL, 'blob', 'Ảnh đại diện của bong bóng chat'),
    ('suggested_questions', '["Khi nào nhập học?","Các ngành điện?","Học phí?","Thời gian đào tạo?","Học bổng?","Tìm việc làm?"]', 'json', 'Danh sách câu hỏi gợi ý'),
    ('bot_name', 'Phòng đào tạo', 'string', 'Tên của bot');

