"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Props = { fileName: string; contentType: string; url: string };

export function FilePreviewModal({ fileName, contentType, url }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const isImage = contentType.startsWith("image/");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="font-semibold text-primary hover:underline">Ver</button>
    <dialog ref={dialogRef} onClose={() => setOpen(false)} onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) setOpen(false); }} className="m-auto h-[90vh] w-[min(94vw,1100px)] max-w-none rounded-xl border border-outline-variant bg-surface-container p-0 text-on-surface shadow-2xl backdrop:bg-black/80">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-outline-variant px-4 py-3">
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Vista previa</p><h3 className="truncate text-sm font-bold text-on-surface" title={fileName}>{fileName}</h3></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar visor" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-outline-variant bg-surface text-xl text-on-surface hover:bg-surface-container-high">×</button>
        </header>
        <div className="min-h-0 flex-1 bg-black/30 p-3">
          {open && isImage ? <div className="flex h-full items-center justify-center overflow-auto"><Image src={url} alt={fileName} width={1600} height={1200} unoptimized className="h-auto max-h-full w-auto max-w-full object-contain" /></div> : null}
          {open && !isImage ? <iframe src={url} title={`Vista previa de ${fileName}`} className="h-full w-full rounded bg-white" /> : null}
        </div>
      </div>
    </dialog>
  </>;
}
