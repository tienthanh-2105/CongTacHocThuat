IF COL_LENGTH(N'dbo.CHIPHITHUCTE', N'MaKPHD') IS NULL
  ALTER TABLE dbo.CHIPHITHUCTE ADD MaKPHD BIGINT NULL;
GO
-- Actual expenses may differ from the estimate. Keep the estimate visible and route
-- the variance to faculty review with the settlement.
CREATE OR ALTER TRIGGER dbo.trg_ChiPhiKhongVuotDuToan
ON dbo.CHIPHITHUCTE
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
END;
