"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "./dashboard.module.css";

export default function NoticeDialog({ message, kind, title, onClose }: { message: string; kind: "success" | "error"; title?: string; onClose: () => void }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => closeRef.current(), 10_000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!mounted) return null;
  return createPortal(<div className={s.noticeDialog} data-kind={kind} role="dialog" aria-label={title ?? (kind === "error" ? "Thông báo lỗi" : "Thông báo thành công")}>
    <span aria-hidden="true">{kind === "error" ? "⚠" : "✓"}</span>
    <div className={s.noticeDialogContent}>
      {title && <strong className={s.noticeDialogTitle}>{title}</strong>}
      <p role={kind === "error" ? "alert" : "status"}>{message}</p>
    </div>
    <button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button>
  </div>, document.body);
}
