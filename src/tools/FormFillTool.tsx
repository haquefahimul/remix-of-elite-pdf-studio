import { useEffect, useState } from "react";
import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
} from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

type FieldKind = "text" | "checkbox" | "radio" | "dropdown" | "list";
type FieldRow = {
  name: string;
  kind: FieldKind;
  options?: string[];
  value: string | boolean;
  multiline?: boolean;
};

export function FormFillTool() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [flatten, setFlatten] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFields([]);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
        const form = pdf.getForm();
        const rows: FieldRow[] = [];
        for (const f of form.getFields()) {
          const name = f.getName();
          if (f instanceof PDFTextField) {
            rows.push({
              name,
              kind: "text",
              value: f.getText() ?? "",
              multiline: f.isMultiline(),
            });
          } else if (f instanceof PDFCheckBox) {
            rows.push({ name, kind: "checkbox", value: f.isChecked() });
          } else if (f instanceof PDFRadioGroup) {
            rows.push({
              name,
              kind: "radio",
              options: f.getOptions(),
              value: f.getSelected() ?? "",
            });
          } else if (f instanceof PDFDropdown) {
            rows.push({
              name,
              kind: "dropdown",
              options: f.getOptions(),
              value: f.getSelected()[0] ?? "",
            });
          } else if (f instanceof PDFOptionList) {
            rows.push({
              name,
              kind: "list",
              options: f.getOptions(),
              value: f.getSelected()[0] ?? "",
            });
          }
        }
        if (!cancelled) setFields(rows);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError("Couldn't read form fields from this PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const update = (i: number, value: string | boolean) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, value } : f)));

  const handleFill = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const form = pdf.getForm();
      for (const row of fields) {
        try {
          if (row.kind === "text") {
            form.getTextField(row.name).setText(String(row.value || ""));
          } else if (row.kind === "checkbox") {
            const cb = form.getCheckBox(row.name);
            if (row.value) cb.check();
            else cb.uncheck();
          } else if (row.kind === "radio" && row.value) {
            form.getRadioGroup(row.name).select(String(row.value));
          } else if (row.kind === "dropdown" && row.value) {
            form.getDropdown(row.name).select(String(row.value));
          } else if (row.kind === "list" && row.value) {
            form.getOptionList(row.name).select(String(row.value));
          }
        } catch (err) {
          console.warn("Field skip", row.name, err);
        }
      }
      if (flatten) form.flatten();
      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (filled).pdf`,
      );
      toast.success("Form filled");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't fill the form.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a fillable PDF"
        hint="Folio reads every text, checkbox, dropdown, and radio field"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      {loadError ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : fields.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          No interactive form fields detected. (If your PDF has fields drawn as
          plain rectangles, try the Edit tool instead.)
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {fields.map((f, i) => (
              <div
                key={f.name + i}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">{f.name}</p>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {f.kind}
                  </span>
                </div>
                <div className="mt-3">
                  {f.kind === "text" &&
                    (f.multiline ? (
                      <textarea
                        rows={3}
                        value={String(f.value)}
                        onChange={(e) => update(i, e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                    ) : (
                      <input
                        value={String(f.value)}
                        onChange={(e) => update(i, e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                    ))}
                  {f.kind === "checkbox" && (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(f.value)}
                        onChange={(e) => update(i, e.target.checked)}
                        className="h-4 w-4 accent-foreground"
                      />
                      <span className="text-muted-foreground">Checked</span>
                    </label>
                  )}
                  {(f.kind === "dropdown" || f.kind === "list" || f.kind === "radio") && (
                    <select
                      value={String(f.value)}
                      onChange={(e) => update(i, e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                    >
                      <option value="">— choose —</option>
                      {(f.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          <label className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={flatten}
              onChange={(e) => setFlatten(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Flatten fields after filling (no longer editable)
          </label>
        </>
      )}

      <ActionBar
        status={
          fields.length > 0
            ? `${fields.length} field${fields.length === 1 ? "" : "s"} ready`
            : "No fields"
        }
        primary={
          <button
            onClick={handleFill}
            disabled={busy || fields.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Filling…" : "Fill & download"}
          </button>
        }
      />
    </div>
  );
}
