-- Keep the legacy plan link available alongside the current faculty-plan link.
-- Existing faculty-plan links and activity records are retained unchanged.
IF COL_LENGTH(N'dbo.HOATDONGHOCTHUAT',N'MaKeHoach') IS NULL
  ALTER TABLE dbo.HOATDONGHOCTHUAT ADD MaKeHoach BIGINT NULL;
