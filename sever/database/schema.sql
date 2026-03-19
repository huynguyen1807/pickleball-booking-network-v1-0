-- =============================================
-- PICKLEBALL SOCIAL PLATFORM - SQL SERVER SCHEMA
-- =============================================

-- Create database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'pickleball_danang')
  CREATE DATABASE pickleball_danang;
GO
USE pickleball_danang;
GO

-- USERS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
CREATE TABLE users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  email NVARCHAR(255) NOT NULL UNIQUE,
  password NVARCHAR(255) NOT NULL,
  full_name NVARCHAR(100) NOT NULL,
  phone NVARCHAR(20),
  avatar NVARCHAR(500),
  role NVARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','owner','admin')),
  status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','pending','rejected','banned')),
  business_license_url NVARCHAR(500) NULL,
  is_verified BIT DEFAULT 0,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  failed_login_count INT DEFAULT 0,
  locked_until DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- UPGRADE REQUESTS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='upgrade_requests' AND xtype='U')
CREATE TABLE upgrade_requests (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
  reason NVARCHAR(MAX),
  status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note NVARCHAR(MAX),
  business_license_url NVARCHAR(MAX),
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- FACILITIES
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='facilities' AND xtype='U')
CREATE TABLE facilities (
  id INT IDENTITY(1,1) PRIMARY KEY,
  owner_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
  name NVARCHAR(200) NOT NULL,
  address NVARCHAR(500) NOT NULL,
  description NVARCHAR(MAX),

  phone NVARCHAR(20),
  open_time VARCHAR(10),
  close_time VARCHAR(10),

  avatar NVARCHAR(500),
  cover_image NVARCHAR(500),

  gallery NVARCHAR(MAX),     -- JSON list ảnh
  amenities NVARCHAR(MAX),   -- JSON list tiện ích

  is_active BIT DEFAULT 1,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- COURTS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='courts' AND xtype='U')
CREATE TABLE courts (
  id INT IDENTITY(1,1) PRIMARY KEY,

  facility_id INT NOT NULL
  FOREIGN KEY REFERENCES facilities(id) ON DELETE CASCADE,

  name NVARCHAR(200) NOT NULL,
  image NVARCHAR(500),

  price_per_hour DECIMAL(12,2) NOT NULL,

  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),

  court_type NVARCHAR(50),      -- indoor / outdoor
  surface_type NVARCHAR(50),    -- hard / grass / synthetic
  status NVARCHAR(20),          -- active / maintenance

  peak_start_time VARCHAR(10),
  peak_end_time VARCHAR(10),
  peak_price DECIMAL(12,2),

  weekend_price DECIMAL(12,2),

  slot_step_minutes INT DEFAULT 60,

  is_active BIT DEFAULT 1,
  price_per_hour DECIMAL(12,2) DEFAULT 0.00,
  peak_start_time DATETIME NULL,
  peak_end_time DATETIME NULL,
  peak_price_per_hour DECIMAL(12,2) DEFAULT 0.00,
  weekend_price_per_hour DECIMAL(12,2) DEFAULT 0.00,
  min_booking_minutes INT DEFAULT 30,
  slot_step_minutes INT DEFAULT 15,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- SUB COURTS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sub_courts' AND xtype='U')
CREATE TABLE sub_courts (
  id INT IDENTITY(1,1) PRIMARY KEY,
  court_id INT NOT NULL FOREIGN KEY REFERENCES courts(id) ON DELETE CASCADE,
  name NVARCHAR(200) NOT NULL,
  court_type NVARCHAR(50) NOT NULL,
  surface_type NVARCHAR(50) NOT NULL,
  status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','maintenance')),
  price_per_hour DECIMAL(12,2) DEFAULT 0.00,
  peak_start_time TIMESTAMP NULL,
  peak_end_time TIMESTAMP NULL,
  peak_price_per_hour DECIMAL(12,2) DEFAULT 0.00,
  weekend_price_per_hour DECIMAL(12,2) DEFAULT 0.00,
  min_booking_minutes INT DEFAULT 30,
  slot_step_minutes INT DEFAULT 15,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);
GO

-- Add pricing columns to sub_courts if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sub_courts') AND name = 'price_per_hour')
  ALTER TABLE sub_courts ADD price_per_hour DECIMAL(12,2) DEFAULT 0.00;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sub_courts') AND name = 'peak_start_time')
  ALTER TABLE sub_courts ADD peak_start_time TIME NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sub_courts') AND name = 'peak_end_time')
  ALTER TABLE sub_courts ADD peak_end_time TIME NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sub_courts') AND name = 'peak_price_per_hour')
  ALTER TABLE sub_courts ADD peak_price_per_hour DECIMAL(12,2) DEFAULT 0.00;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sub_courts') AND name = 'weekend_price_per_hour')
  ALTER TABLE sub_courts ADD weekend_price_per_hour DECIMAL(12,2) DEFAULT 0.00;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sub_courts') AND name = 'min_booking_minutes')
  ALTER TABLE sub_courts ADD min_booking_minutes INT DEFAULT 30;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sub_courts') AND name = 'slot_step_minutes')
  ALTER TABLE sub_courts ADD slot_step_minutes INT DEFAULT 15;
GO

-- COURT SLOTS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='court_slots' AND xtype='U')
CREATE TABLE court_slots (
  id INT IDENTITY(1,1) PRIMARY KEY,
  court_id INT NOT NULL FOREIGN KEY REFERENCES courts(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BIT DEFAULT 1
);
GO

-- POSTS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='posts' AND xtype='U')
CREATE TABLE posts (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
  content NVARCHAR(MAX) NOT NULL,
  image NVARCHAR(MAX),
  post_type NVARCHAR(20) DEFAULT 'share' CHECK (post_type IN ('find_player','share','ad','event')),
  is_promoted BIT DEFAULT 0,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- POST LIKES
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='post_likes' AND xtype='U')
CREATE TABLE post_likes (
  id INT IDENTITY(1,1) PRIMARY KEY,
  post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE NO ACTION,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- Ensure a user can like a post only once
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_post_likes_post_user')
CREATE UNIQUE INDEX UQ_post_likes_post_user ON post_likes(post_id, user_id);
GO

-- COMMENTS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='comments' AND xtype='U')
CREATE TABLE comments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE NO ACTION,
  content NVARCHAR(MAX) NOT NULL,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- POST SHARES
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='post_shares' AND xtype='U')
CREATE TABLE post_shares (
  id INT IDENTITY(1,1) PRIMARY KEY,
  post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NULL FOREIGN KEY REFERENCES users(id) ON DELETE NO ACTION,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- BOOKINGS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='bookings' AND xtype='U')
CREATE TABLE bookings (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  court_id INT NOT NULL FOREIGN KEY REFERENCES courts(id),
  court_slot_id INT FOREIGN KEY REFERENCES court_slots(id),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(4,2) DEFAULT 0.05,
  commission_amount DECIMAL(12,2),
  status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  payment_method NVARCHAR(50),
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- MATCHES (matchmaking)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='matches' AND xtype='U')
CREATE TABLE matches (
  id INT IDENTITY(1,1) PRIMARY KEY,
  creator_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  court_id INT NOT NULL FOREIGN KEY REFERENCES courts(id),
  court_slot_id INT FOREIGN KEY REFERENCES court_slots(id),
  match_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_players INT DEFAULT 4,
  current_players INT DEFAULT 1,
  total_cost DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(4,2) DEFAULT 0.05,
  status NVARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting','confirmed','completed','cancelled')),
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- MATCH PLAYERS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='match_players' AND xtype='U')
CREATE TABLE match_players (
  id INT IDENTITY(1,1) PRIMARY KEY,
  match_id INT NOT NULL FOREIGN KEY REFERENCES matches(id) ON DELETE CASCADE,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  status NVARCHAR(20) DEFAULT 'joined' CHECK (status IN ('joined','left')),
  payment_status NVARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  amount_due DECIMAL(12,2),
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- PAYMENTS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payments' AND xtype='U')
CREATE TABLE payments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  booking_id INT FOREIGN KEY REFERENCES bookings(id),
  match_id INT FOREIGN KEY REFERENCES matches(id),
  amount DECIMAL(12,2) NOT NULL,
  commission DECIMAL(12,2) DEFAULT 0,
  payment_method NVARCHAR(50) DEFAULT 'mock',
  transaction_id NVARCHAR(100) UNIQUE,
  status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded','cancelled','expired')),
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- NOTIFICATIONS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U')
CREATE TABLE notifications (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
  title NVARCHAR(200) NOT NULL,
  message NVARCHAR(MAX),
  type NVARCHAR(50),
  reference_id INT,
  is_read BIT DEFAULT 0,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- CHAT ROOMS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='chat_rooms' AND xtype='U')
CREATE TABLE chat_rooms (
  id INT IDENTITY(1,1) PRIMARY KEY,
  match_id INT FOREIGN KEY REFERENCES matches(id),
  name NVARCHAR(200),
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- CHAT ROOM MEMBERS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='chat_room_members' AND xtype='U')
CREATE TABLE chat_room_members (
  id INT IDENTITY(1,1) PRIMARY KEY,
  chat_room_id INT NOT NULL FOREIGN KEY REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id)
);
GO

-- MESSAGES
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='messages' AND xtype='U')
CREATE TABLE messages (
  id INT IDENTITY(1,1) PRIMARY KEY,
  chat_room_id INT NOT NULL FOREIGN KEY REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  content NVARCHAR(MAX) NOT NULL,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- REVIEWS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reviews' AND xtype='U')
CREATE TABLE reviews (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  court_id INT NOT NULL FOREIGN KEY REFERENCES courts(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment NVARCHAR(MAX),
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
GO

-- SEED ADMIN (password: password - bcrypt hash)
IF NOT EXISTS (SELECT id FROM users WHERE email = 'admin@pickleball.vn')
INSERT INTO users (email, password, full_name, phone, role, status)
VALUES ('admin@pickleball.vn', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin System', '0900000000', 'admin', 'active');
GO

-- MIGRATION: Expand posts.image column to hold base64 images (run once automatically by db.ts on startup)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='posts' AND COLUMN_NAME='image' AND DATA_TYPE='nvarchar' AND CHARACTER_MAXIMUM_LENGTH=500)
    ALTER TABLE posts ALTER COLUMN image NVARCHAR(MAX);
GO

-- MIGRATION: Add failed login tracking columns to users table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'failed_login_count')
    ALTER TABLE users ADD failed_login_count INT DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'locked_until')
    ALTER TABLE users ADD locked_until DATETIMEOFFSET NULL;
GO
