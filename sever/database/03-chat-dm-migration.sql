-- Migration: Add DM support to chat system
-- Adds room_type to chat_rooms and is_read to messages

USE pickleball_danang;
GO

-- Add room_type column to chat_rooms (match = match chat, dm = direct message)
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'chat_rooms' AND COLUMN_NAME = 'room_type'
)
BEGIN
    ALTER TABLE chat_rooms ADD room_type NVARCHAR(20) DEFAULT 'match';
END
GO

-- Update existing rooms to 'match' type
UPDATE chat_rooms SET room_type = 'match' WHERE room_type IS NULL;
GO

-- Add is_read column to messages
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'messages' AND COLUMN_NAME = 'is_read'
)
BEGIN
    ALTER TABLE messages ADD is_read BIT DEFAULT 0;
END
GO

-- Mark all existing messages as read
UPDATE messages SET is_read = 1 WHERE is_read IS NULL;
GO

PRINT 'Chat DM migration completed successfully';
GO
