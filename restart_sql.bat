@echo off
echo Dang khoi dong lai SQL Server (MSSQLSERVER) de ap dung TCP/IP...
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command Restart-Service MSSQLSERVER -Force'"
echo Da gui lenh khoi dong lai. Vui long chon 'Yes' tren man hinh UAC neu co.
