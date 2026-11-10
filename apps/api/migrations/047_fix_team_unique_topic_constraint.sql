DECLARE @wrongConstraint sysname;

SELECT TOP (1) @wrongConstraint = kc.name
FROM sys.key_constraints kc
JOIN sys.index_columns ic
  ON ic.object_id = kc.parent_object_id
 AND ic.index_id = kc.unique_index_id
 AND ic.key_ordinal = 1
JOIN sys.columns c
  ON c.object_id = ic.object_id
 AND c.column_id = ic.column_id
WHERE kc.parent_object_id = OBJECT_ID(N'dbo.DOITHI')
  AND kc.type = N'UQ'
  AND c.name = N'MaDeTai'
  AND NOT EXISTS (
    SELECT 1
    FROM sys.index_columns extra
    WHERE extra.object_id = kc.parent_object_id
      AND extra.index_id = kc.unique_index_id
      AND extra.key_ordinal > 1
  );

IF @wrongConstraint IS NOT NULL
BEGIN
  DECLARE @dropSql NVARCHAR(MAX) = N'ALTER TABLE dbo.DOITHI DROP CONSTRAINT ' + QUOTENAME(@wrongConstraint);
  EXEC(@dropSql);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.DOITHI')
    AND i.is_unique = 1
    AND 2 = (
      SELECT COUNT(*)
      FROM sys.index_columns ic
      WHERE ic.object_id = i.object_id
        AND ic.index_id = i.index_id
        AND ic.key_ordinal > 0
    )
    AND EXISTS (
      SELECT 1 FROM sys.index_columns ic
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        AND ic.key_ordinal = 1 AND c.name = N'MaCThi'
    )
    AND EXISTS (
      SELECT 1 FROM sys.index_columns ic
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        AND ic.key_ordinal = 2 AND c.name = N'TenDoi'
    )
)
BEGIN
  ALTER TABLE dbo.DOITHI
    ADD CONSTRAINT UQ_DOITHI_CUOCTHI UNIQUE (MaCThi, TenDoi);
END;
GO
