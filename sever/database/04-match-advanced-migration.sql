-- ============================================================
-- Migration 04: Advanced Matchmaking Features
-- Run once to add format, skill_level, description columns,
-- and update status constraints.
-- ============================================================


USE pickleball_danang;
GO


-- 1. Add format column (1v1 | 2v2)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('matches') AND name = 'format')
    ALTER TABLE matches ADD format NVARCHAR(10) DEFAULT '2v2';
GO

-- 2. Add skill_level column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('matches') AND name = 'skill_level')
    ALTER TABLE matches ADD skill_level NVARCHAR(20) DEFAULT 'all';
GO

-- 3. Add description column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('matches') AND name = 'description')
    ALTER TABLE matches ADD description NVARCHAR(500);
GO

-- 4. Update matches.status CHECK constraint to include 'full' and 'finished'
DECLARE @matchStatusConstraint NVARCHAR(200);
SELECT TOP 1 @matchStatusConstraint = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('matches')
  AND definition LIKE '%status%';

IF @matchStatusConstraint IS NOT NULL
BEGIN
    EXEC('ALTER TABLE matches DROP CONSTRAINT [' + @matchStatusConstraint + ']');
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('matches') AND name = 'CK_matches_status'
)
ALTER TABLE matches
ADD CONSTRAINT CK_matches_status
CHECK (status IN ('waiting','open','full','confirmed','completed','finished','cancelled'));
GO

-- 5. Update match_players.status CHECK constraint to include 'waitlist'
DECLARE @mpStatusConstraint NVARCHAR(200);
SELECT TOP 1 @mpStatusConstraint = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('match_players')
  AND definition LIKE '%status%';

IF @mpStatusConstraint IS NOT NULL
BEGIN
    EXEC('ALTER TABLE match_players DROP CONSTRAINT [' + @mpStatusConstraint + ']');
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('match_players') AND name = 'CK_match_players_status'
)
ALTER TABLE match_players
ADD CONSTRAINT CK_match_players_status
CHECK (status IN ('joined','waitlist','left'));
GO

PRINT 'Migration 04 (Advanced Matchmaking) completed successfully.';
GO
