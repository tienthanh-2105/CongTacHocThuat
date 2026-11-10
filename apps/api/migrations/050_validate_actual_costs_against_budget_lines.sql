CREATE OR ALTER TRIGGER dbo.trg_ChiPhiKhongVuotDuToan
ON dbo.CHIPHITHUCTE
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT i.MaHD
    FROM inserted i
    JOIN (
      SELECT MaHD, SUM(SoTien) AS KinhPhiDuTru
      FROM dbo.KINHPHIHOATDONG
      GROUP BY MaHD
    ) budget ON budget.MaHD=i.MaHD
    GROUP BY i.MaHD,budget.KinhPhiDuTru
    HAVING budget.KinhPhiDuTru>0
      AND (SELECT SUM(c.SoTien) FROM dbo.CHIPHITHUCTE c WHERE c.MaHD=i.MaHD)>budget.KinhPhiDuTru
  ) THROW 51001, N'Tổng chi phí thực tế vượt dự toán của hoạt động.', 1;
END;
