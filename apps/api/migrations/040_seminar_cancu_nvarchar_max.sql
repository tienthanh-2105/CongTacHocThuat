-- Migration 040: Nâng cấp trường CanCu trong bảng SEMINAR lên NVARCHAR(MAX)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SEMINAR') AND name = 'CanCu')
BEGIN
    ALTER TABLE SEMINAR ALTER COLUMN CanCu NVARCHAR(MAX) NULL;
END
GO
