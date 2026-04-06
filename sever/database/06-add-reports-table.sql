-- Add Reports Table for Report System
-- This migration adds the reports table to support user reporting functionality

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reports' AND xtype='U')
CREATE TABLE reports (
  id INT IDENTITY(1,1) PRIMARY KEY,
  reporter_id INT NOT NULL,
  report_type NVARCHAR(50) NOT NULL CHECK (report_type IN ('account','post','impostor','court','other')),
  report_target_id INT,
  report_target_type NVARCHAR(50) CHECK (report_target_type IN ('user','post','court')),
  description NVARCHAR(MAX) NOT NULL,
  evidence_urls NVARCHAR(MAX),
  status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','investigating','resolved','rejected')),
  admin_note NVARCHAR(MAX),
  resolved_by INT,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT FK_reports_reporter_id FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE NO ACTION,
  CONSTRAINT FK_reports_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE NO ACTION
);
GO

-- Add index for faster queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_reports_status')
CREATE INDEX IX_reports_status ON reports(status);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_reports_reporter')
CREATE INDEX IX_reports_reporter ON reports(reporter_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_reports_report_type')
CREATE INDEX IX_reports_report_type ON reports(report_type);
GO

PRINT '✅ Reports table created successfully!';
