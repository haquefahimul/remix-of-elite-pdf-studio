import { useCallback, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";

type DropzoneProps = {
  accept: "pdf" | "image" | "pdf-multi";
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  hint?: string;
  className?: string;
  children?: ReactNode;
};

const ACCEPT_MAP = {
  pdf: "application/pdf",
  "pdf-multi": "application/pdf",
  image: "image/jpeg,image/png,image/webp",
};

export function Dropzone({
  accept,
  multiple,
  onFiles,
  title = "Drop your file here",
  hint = "or click to browse",
  className = "",
  children,
}: DropzoneProps) {
  const [isOver, setIsOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const arr = Array.from(fileList).filter((f) => {
        if (accept === "image") return f.type.startsWith("image/");
        return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      });
      if (arr.length > 0) onFiles(arr);
    },
    [accept, onFiles]
  );

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed bg-surface px-6 py-16 text-center transition-all ${
        isOver
          ? "border-foreground/60 bg-accent scale-[1.01]"
          : "border-border-strong/60 hover:border-foreground/40 hover:bg-accent/50"
      } ${className}`}
    >
      <input
        type="file"
        accept={ACCEPT_MAP[accept]}
        multiple={multiple ?? (accept === "pdf-multi" || accept === "image")}
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
      />
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background shadow-soft transition-transform group-hover:-translate-y-0.5">
        <UploadCloud className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-display text-2xl tracking-tight text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </label>
  );
}
