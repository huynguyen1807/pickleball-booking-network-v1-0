-- Add post_media table for multiple images and videos support
CREATE TABLE post_media (
    id INT IDENTITY(1,1) PRIMARY KEY,
    post_id INT NOT NULL,
    media_type NVARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
    file_path NVARCHAR(MAX) NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    mime_type NVARCHAR(50),
    file_size INT,
    uploaded_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    INDEX idx_post_id (post_id)
);

-- Keep image column for backward compatibility but deprecate it
-- ALTER TABLE posts ADD image NVARCHAR(MAX) NULL; -- Already exists, so no change needed
