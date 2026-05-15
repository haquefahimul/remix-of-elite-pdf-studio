import {
  Combine,
  Scissors,
  Minimize2,
  RotateCw,
  LayoutGrid,
  Trash2,
  ImageDown,
  FileImage,
  Stamp,
  Hash,
  PenLine,
  Type,
  Grid2x2,
  Crop,
  FileOutput,
  FileImage as FilePng,
  Tags,
  Unlock,
  Wrench,
  ScanText,
  ShieldCheck,
  FileText,
  Code2,
  GitCompareArrows,
  Eraser,
  FileSpreadsheet,
  Sheet,
  Layers,
  ScanLine,
  Contrast,
  Maximize2,
  BookOpen,
  ArrowDownUp,
  FlipHorizontal,
  Palette,
  Moon,
  Heading,
  BadgeCheck,
  Scaling,
  ListChecks,
  Highlighter,
  FileType,
  FileDiff,
  FileCode2,
  Square,
  Copy,
  Slice,
  Columns2,
  FileX2,
  SplitSquareVertical,
  FilePlus2,
  Info,
  PackageOpen,
  FileType2,
  Bookmark,
  Paperclip,
  PaperclipIcon,
  MessageSquareOff,
  ImageMinus,
  StretchVertical,
  Boxes,
  Shuffle,
  Search,
  Camera,
  BookCopy,
  Droplets,
  ImagePlus,
  Calculator,
  MoveDiagonal,
  RefreshCcw,
  Replace,
  SquareDashed,
  FileCode,
  Aperture,
  Braces,
  Maximize,
  type LucideIcon,
} from "lucide-react";

export type ToolId =
  | "merge"
  | "split"
  | "compress"
  | "rotate"
  | "organize"
  | "delete"
  | "pdf-to-jpg"
  | "jpg-to-pdf"
  | "watermark"
  | "page-numbers"
  | "sign"
  | "edit"
  | "nup"
  | "crop"
  | "extract"
  | "pdf-to-png"
  | "metadata"
  | "unlock"
  | "repair"
  | "ocr"
  | "protect"
  | "pdf-to-word"
  | "html-to-pdf"
  | "compare"
  | "redact"
  | "excel-to-pdf"
  | "pdf-to-excel"
  | "flatten"
  | "bates"
  | "scan"
  | "grayscale"
  | "resize"
  | "booklet"
  | "reverse"
  | "mirror"
  | "background"
  | "invert"
  | "header-footer"
  | "stamp"
  | "auto-crop"
  | "form-fill"
  | "annotate"
  | "pdf-to-text"
  | "compare-text"
  | "pdf-to-markdown"
  | "margins"
  | "repeat"
  | "split-by-size"
  | "un-nup"
  | "remove-blank"
  | "even-odd"
  | "text-to-pdf"
  | "pdf-info"
  | "split-by-pages"
  | "insert-blank"
  | "bookmarks"
  | "attachments"
  | "attach"
  | "strip-annotations"
  | "image-compress"
  | "long-image"
  | "smart-combine"
  | "interleave"
  | "highlight-search"
  | "page-snapshot"
  | "cover-page"
  | "image-grayscale"
  | "image-watermark"
  | "page-counter"
  | "image-resize"
  | "image-rotate"
  | "image-convert"
  | "borders"
  | "pdf-to-html"
  | "image-crop"
  | "image-blur"
  | "csv-to-pdf"
  | "json-to-pdf"
  | "page-size"
  | "image-trim"
  | "contact-sheet";

export type Tool = {
  id: ToolId;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
  accept: "pdf" | "image" | "pdf-multi";
  /** Optional grouping label */
  group?: "Organize" | "Convert" | "Edit" | "Optimize";
};

export const TOOLS: Tool[] = [
  {
    id: "merge",
    slug: "merge",
    name: "Merge PDF",
    tagline: "Combine into one",
    description:
      "Drag, drop, reorder, and stitch multiple PDFs into a single document — instantly, in your browser.",
    icon: Combine,
    accent: "text-tool-merge",
    accentSoft: "bg-tool-merge/10",
    accept: "pdf-multi",
    group: "Organize",
  },
  {
    id: "split",
    slug: "split",
    name: "Split PDF",
    tagline: "Pull out the pages you need",
    description:
      "Extract a single page, a custom range, or split into individual files with surgical precision.",
    icon: Scissors,
    accent: "text-tool-split",
    accentSoft: "bg-tool-split/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "organize",
    slug: "organize",
    name: "Organize PDF",
    tagline: "Reorder with a flick",
    description:
      "Tactile drag-and-drop page reordering. Rearrange large documents like a stack of cards.",
    icon: LayoutGrid,
    accent: "text-tool-organize",
    accentSoft: "bg-tool-organize/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "delete",
    slug: "delete-pages",
    name: "Delete Pages",
    tagline: "Trim what you don't need",
    description:
      "Click pages to remove them. Live thumbnails, batch select, and instant export.",
    icon: Trash2,
    accent: "text-tool-delete",
    accentSoft: "bg-tool-delete/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "rotate",
    slug: "rotate",
    name: "Rotate PDF",
    tagline: "Right-side up, every time",
    description:
      "Rotate every page or pick exactly the ones you want. Live preview as you turn.",
    icon: RotateCw,
    accent: "text-tool-rotate",
    accentSoft: "bg-tool-rotate/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "compress",
    slug: "compress",
    name: "Compress PDF",
    tagline: "Smaller files, sharper results",
    description:
      "Shrink huge PDFs while preserving the visual fidelity that matters. Perfect for email and the web.",
    icon: Minimize2,
    accent: "text-tool-compress",
    accentSoft: "bg-tool-compress/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "watermark",
    slug: "watermark",
    name: "Watermark",
    tagline: "Brand every page",
    description:
      "Stamp text or an image onto every page with control over opacity, rotation, position, and tiling.",
    icon: Stamp,
    accent: "text-tool-watermark",
    accentSoft: "bg-tool-watermark/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "page-numbers",
    slug: "page-numbers",
    name: "Page Numbers",
    tagline: "Number any sequence",
    description:
      "Insert page numbers anywhere on the page with formats like “Page X of Y”, custom start, and ranges.",
    icon: Hash,
    accent: "text-tool-pagenum",
    accentSoft: "bg-tool-pagenum/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "sign",
    slug: "sign",
    name: "Sign PDF",
    tagline: "Draw your signature",
    description:
      "Draw a signature on a touch-friendly canvas, place it on any page, and download the signed PDF.",
    icon: PenLine,
    accent: "text-tool-sign",
    accentSoft: "bg-tool-sign/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "edit",
    slug: "edit",
    name: "Edit PDF",
    tagline: "Add text & shapes",
    description:
      "Drop text boxes, shapes, and highlights onto any page. Drag to position, resize, and ship.",
    icon: Type,
    accent: "text-tool-edit",
    accentSoft: "bg-tool-edit/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "nup",
    slug: "n-up",
    name: "N-up PDF",
    tagline: "Multiple pages per sheet",
    description:
      "Combine 2, 4, 6, or 9 pages onto a single sheet. Great for handouts, booklets, and printing.",
    icon: Grid2x2,
    accent: "text-tool-nup",
    accentSoft: "bg-tool-nup/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "pdf-to-jpg",
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    tagline: "Crisp images from any page",
    description:
      "Render every page to a high-resolution JPG. Bundled into a single .zip for download.",
    icon: ImageDown,
    accent: "text-tool-pdf-jpg",
    accentSoft: "bg-tool-pdf-jpg/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "jpg-to-pdf",
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    tagline: "Photos to print-ready PDF",
    description:
      "Drop in JPGs or PNGs, choose page size and orientation, export a polished PDF.",
    icon: FileImage,
    accent: "text-tool-jpg-pdf",
    accentSoft: "bg-tool-jpg-pdf/10",
    accept: "image",
    group: "Convert",
  },
  {
    id: "pdf-to-png",
    slug: "pdf-to-png",
    name: "PDF to PNG",
    tagline: "Lossless transparent images",
    description:
      "Render every page to crisp PNGs at the resolution you choose. Optional grayscale, bundled into a zip.",
    icon: FilePng,
    accent: "text-tool-pdf-png",
    accentSoft: "bg-tool-pdf-png/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "crop",
    slug: "crop",
    name: "Crop PDF",
    tagline: "Trim margins everywhere",
    description:
      "Set precise crop margins on every page in millimetres or apply a visual preset. Output keeps original quality.",
    icon: Crop,
    accent: "text-tool-crop",
    accentSoft: "bg-tool-crop/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "extract",
    slug: "extract",
    name: "Extract Pages",
    tagline: "Pull out exactly what matters",
    description:
      "Pick the pages you need by clicking thumbnails or by typing a page range. Export a clean new PDF.",
    icon: FileOutput,
    accent: "text-tool-extract",
    accentSoft: "bg-tool-extract/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "metadata",
    slug: "metadata",
    name: "Edit Metadata",
    tagline: "Title, author & more",
    description:
      "Inspect and rewrite PDF title, author, subject, keywords, and producer fields without re-flowing the document.",
    icon: Tags,
    accent: "text-tool-metadata",
    accentSoft: "bg-tool-metadata/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "unlock",
    slug: "unlock",
    name: "Unlock PDF",
    tagline: "Remove a known password",
    description:
      "Type the document's password and download a clean copy with encryption stripped. Nothing leaves your machine.",
    icon: Unlock,
    accent: "text-tool-unlock",
    accentSoft: "bg-tool-unlock/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "repair",
    slug: "repair",
    name: "Repair PDF",
    tagline: "Fix corrupted files",
    description:
      "Reparse a damaged PDF, drop invalid objects, and resave a clean version that opens in any reader.",
    icon: Wrench,
    accent: "text-tool-repair",
    accentSoft: "bg-tool-repair/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "ocr",
    slug: "ocr",
    name: "OCR PDF",
    tagline: "Make scans searchable",
    description:
      "Recognise text on scanned pages with on-device OCR in 6 languages and download a searchable PDF plus plain text.",
    icon: ScanText,
    accent: "text-tool-ocr",
    accentSoft: "bg-tool-ocr/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "protect",
    slug: "protect",
    name: "Protect PDF",
    tagline: "Add a password gate",
    description:
      "Wrap any PDF in a password prompt before it opens. Strength meter, double confirmation, and zero servers.",
    icon: ShieldCheck,
    accent: "text-tool-protect",
    accentSoft: "bg-tool-protect/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "pdf-to-word",
    slug: "pdf-to-word",
    name: "PDF to Word",
    tagline: "Editable .docx output",
    description:
      "Extract text into a real Word document with flow or line-preserving layouts. Tables and images stay as text where possible.",
    icon: FileText,
    accent: "text-tool-pdf-word",
    accentSoft: "bg-tool-pdf-word/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "html-to-pdf",
    slug: "html-to-pdf",
    name: "HTML to PDF",
    tagline: "Web pages to print-ready",
    description:
      "Paste HTML, type Markdown, or fetch a URL — Folio renders it locally and exports a clean paginated PDF.",
    icon: Code2,
    accent: "text-tool-html-pdf",
    accentSoft: "bg-tool-html-pdf/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "compare",
    slug: "compare",
    name: "Compare PDFs",
    tagline: "Spot every change",
    description:
      "Drop two versions of a document and see a side-by-side visual diff with red overlays on every changed pixel.",
    icon: GitCompareArrows,
    accent: "text-tool-compare",
    accentSoft: "bg-tool-compare/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "redact",
    slug: "redact",
    name: "Redact PDF",
    tagline: "Black out sensitive data",
    description:
      "Drag rectangles over confidential text — Folio flattens true black blocks and strips metadata before export.",
    icon: Eraser,
    accent: "text-tool-redact",
    accentSoft: "bg-tool-redact/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "excel-to-pdf",
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    tagline: "Spreadsheets, ready to share",
    description:
      "Drop in .xlsx, .xls, .csv, or .ods. Folio lays out every sheet onto auto-fitted pages with optional cell borders.",
    icon: FileSpreadsheet,
    accent: "text-tool-excel-pdf",
    accentSoft: "bg-tool-excel-pdf/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "pdf-to-excel",
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    tagline: "Tables back into rows",
    description:
      "Lift table-like content out of any text-based PDF and rebuild a clean .xlsx — one sheet per page, or all in one.",
    icon: Sheet,
    accent: "text-tool-pdf-excel",
    accentSoft: "bg-tool-pdf-excel/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "flatten",
    slug: "flatten",
    name: "Flatten PDF",
    tagline: "Bake everything in",
    description:
      "Lock down form fields, strip embedded scripts, and ship a static, tamper-resistant copy of any PDF.",
    icon: Layers,
    accent: "text-tool-flatten",
    accentSoft: "bg-tool-flatten/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "bates",
    slug: "bates-numbering",
    name: "Bates Numbering",
    tagline: "Legal-grade page IDs",
    description:
      "Stamp a continuous sequence — DOC-000001, DOC-000002 — across one or many PDFs with prefix, suffix, and padding control.",
    icon: Hash,
    accent: "text-tool-bates",
    accentSoft: "bg-tool-bates/10",
    accept: "pdf-multi",
    group: "Edit",
  },
  {
    id: "scan",
    slug: "scan",
    name: "Scan to PDF",
    tagline: "Camera straight to PDF",
    description:
      "Capture multi-page documents with your webcam or phone, auto-threshold to crisp B&W, and export a single tidy PDF.",
    icon: ScanLine,
    accent: "text-tool-scan",
    accentSoft: "bg-tool-scan/10",
    accept: "image",
    group: "Convert",
  },
  {
    id: "grayscale",
    slug: "grayscale",
    name: "Grayscale PDF",
    tagline: "Save ink, unify look",
    description:
      "Convert every page to grayscale with adjustable resolution and quality. Perfect for printing or archival.",
    icon: Contrast,
    accent: "text-tool-grayscale",
    accentSoft: "bg-tool-grayscale/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "resize",
    slug: "resize",
    name: "Resize PDF",
    tagline: "Switch page size",
    description:
      "Move every page to A4, Letter, Legal, A3, A5, or Tabloid — fit content cleanly or stretch to the new size.",
    icon: Maximize2,
    accent: "text-tool-resize",
    accentSoft: "bg-tool-resize/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "booklet",
    slug: "booklet",
    name: "Booklet PDF",
    tagline: "Saddle-stitch imposition",
    description:
      "Reorder pages 2-up onto landscape sheets so a double-sided print folds into a real booklet.",
    icon: BookOpen,
    accent: "text-tool-booklet",
    accentSoft: "bg-tool-booklet/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "reverse",
    slug: "reverse",
    name: "Reverse Pages",
    tagline: "Last to first",
    description:
      "Flip the entire page order in one click — perfect for scans that came out backwards.",
    icon: ArrowDownUp,
    accent: "text-tool-reverse",
    accentSoft: "bg-tool-reverse/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "mirror",
    slug: "mirror",
    name: "Mirror PDF",
    tagline: "Flip horizontally or vertically",
    description:
      "Mirror every page across the X axis, Y axis, or both. Great for transfer printing and mockups.",
    icon: FlipHorizontal,
    accent: "text-tool-mirror",
    accentSoft: "bg-tool-mirror/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "background",
    slug: "background",
    name: "Add Background",
    tagline: "Color or full-bleed image",
    description:
      "Layer a solid color or image behind every page with adjustable opacity. Existing content stays on top.",
    icon: Palette,
    accent: "text-tool-background",
    accentSoft: "bg-tool-background/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "invert",
    slug: "invert",
    name: "Invert Colors",
    tagline: "Dark-mode any PDF",
    description:
      "Rasterise and color-invert every page so black turns white and back — easy on the eyes for night reading.",
    icon: Moon,
    accent: "text-tool-invert",
    accentSoft: "bg-tool-invert/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "header-footer",
    slug: "header-footer",
    name: "Header & Footer",
    tagline: "Brand every page top & bottom",
    description:
      "Add three-column headers and footers with placeholders like {page}, {pages}, {date}, {filename} — opacity and font size dialed in.",
    icon: Heading,
    accent: "text-tool-header-footer",
    accentSoft: "bg-tool-header-footer/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "stamp",
    slug: "stamp",
    name: "Stamp PDF",
    tagline: "Approved, Draft, Confidential",
    description:
      "Drop preset or custom stamps onto every page with full control over color, size, rotation, opacity, and corner placement.",
    icon: BadgeCheck,
    accent: "text-tool-stamp",
    accentSoft: "bg-tool-stamp/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "auto-crop",
    slug: "auto-crop",
    name: "Auto Crop",
    tagline: "Trim white margins automatically",
    description:
      "Folio rasterises every page, finds the real content edges, and sets a tight crop box — perfect for screenshots and scans.",
    icon: Scaling,
    accent: "text-tool-auto-crop",
    accentSoft: "bg-tool-auto-crop/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "form-fill",
    slug: "form-fill",
    name: "Fill Form",
    tagline: "Type into PDF forms",
    description:
      "Detects every text, checkbox, dropdown, and radio field in a fillable PDF — fill them, optionally flatten, and download.",
    icon: ListChecks,
    accent: "text-tool-form-fill",
    accentSoft: "bg-tool-form-fill/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "annotate",
    slug: "annotate",
    name: "Annotate PDF",
    tagline: "Highlight & sticky-note",
    description:
      "Drag highlight rectangles in four colors or drop sticky notes on any page. Everything bakes into the final PDF.",
    icon: Highlighter,
    accent: "text-tool-annotate",
    accentSoft: "bg-tool-annotate/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "pdf-to-text",
    slug: "pdf-to-text",
    name: "PDF to Text",
    tagline: "Plain .txt extraction",
    description:
      "Pull every word out of a text-based PDF as plain text — flow mode for paragraphs, layout mode to keep tabular shapes.",
    icon: FileType,
    accent: "text-tool-pdf-text",
    accentSoft: "bg-tool-pdf-text/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "compare-text",
    slug: "compare-text",
    name: "Compare Text",
    tagline: "Line-by-line text diff",
    description:
      "Pull text out of two PDFs and produce a clean HTML report that highlights every added and removed line.",
    icon: FileDiff,
    accent: "text-tool-compare-text",
    accentSoft: "bg-tool-compare-text/10",
    accept: "pdf-multi",
    group: "Edit",
  },
  {
    id: "pdf-to-markdown",
    slug: "pdf-to-markdown",
    name: "PDF to Markdown",
    tagline: "Headings, lists, prose",
    description:
      "Folio infers heading levels from font size and bold weight, detects bullet and numbered lists, and emits a clean .md file.",
    icon: FileCode2,
    accent: "text-tool-pdf-md",
    accentSoft: "bg-tool-pdf-md/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "margins",
    slug: "margins",
    name: "Add Margins",
    tagline: "Pad pages with whitespace",
    description:
      "Wrap every page with extra millimetres of margin — perfect for binding, annotation space, or commercial print bleed.",
    icon: Square,
    accent: "text-tool-margins",
    accentSoft: "bg-tool-margins/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "repeat",
    slug: "repeat",
    name: "Repeat Pages",
    tagline: "Make N copies of any range",
    description:
      "Duplicate the whole document or a specific range any number of times — block (1,2,1,2) or interleaved (1,1,2,2) order.",
    icon: Copy,
    accent: "text-tool-repeat",
    accentSoft: "bg-tool-repeat/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "split-by-size",
    slug: "split-by-size",
    name: "Split by Size",
    tagline: "Chunk under any MB cap",
    description:
      "Splits a giant PDF into the fewest possible parts that each fit your size limit — ideal for email attachments and upload caps.",
    icon: Slice,
    accent: "text-tool-split-size",
    accentSoft: "bg-tool-split-size/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "un-nup",
    slug: "un-nup",
    name: "Two-up to One-up",
    tagline: "Slice 2-up scans apart",
    description:
      "Cut every sheet down the middle — left/right or top/bottom — so 2-up scanned books and printed PDFs become single pages again.",
    icon: Columns2,
    accent: "text-tool-unnup",
    accentSoft: "bg-tool-unnup/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "remove-blank",
    slug: "remove-blank-pages",
    name: "Remove Blank Pages",
    tagline: "Auto-detect & drop blanks",
    description:
      "Folio rasterises every page, measures whitespace, and drops blank scans automatically — adjustable threshold included.",
    icon: FileX2,
    accent: "text-tool-remove-blank",
    accentSoft: "bg-tool-remove-blank/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "even-odd",
    slug: "even-odd",
    name: "Even / Odd Pages",
    tagline: "Split by parity",
    description:
      "Pull out just the odd pages, just the even pages, or both at once for double-sided reprint workflows.",
    icon: SplitSquareVertical,
    accent: "text-tool-even-odd",
    accentSoft: "bg-tool-even-odd/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "text-to-pdf",
    slug: "text-to-pdf",
    name: "Text to PDF",
    tagline: "Paste text, get a PDF",
    description:
      "Type or paste plain text and Folio paginates it cleanly with your choice of page size, font, size, and margin.",
    icon: FileType2,
    accent: "text-tool-text-pdf",
    accentSoft: "bg-tool-text-pdf/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "pdf-info",
    slug: "pdf-info",
    name: "PDF Info",
    tagline: "Inspect any document",
    description:
      "Surface page counts, page sizes, fonts, embedded images, metadata, encryption, and PDF version — all on-device.",
    icon: Info,
    accent: "text-tool-pdf-info",
    accentSoft: "bg-tool-pdf-info/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "split-by-pages",
    slug: "split-by-pages",
    name: "Split by Pages",
    tagline: "Equal chunks of N pages",
    description:
      "Slice a long PDF into evenly-sized parts (10 pages each, 25 pages each, whatever you choose) and download as a zip.",
    icon: PackageOpen,
    accent: "text-tool-split-pages",
    accentSoft: "bg-tool-split-pages/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "insert-blank",
    slug: "insert-blank-pages",
    name: "Insert Blank Pages",
    tagline: "Pad anywhere you need",
    description:
      "Add blank pages before or after any page (or at the very end) — match the document size or pick a fresh preset.",
    icon: FilePlus2,
    accent: "text-tool-insert-blank",
    accentSoft: "bg-tool-insert-blank/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "bookmarks",
    slug: "bookmarks",
    name: "View Bookmarks",
    tagline: "Read the table of contents",
    description:
      "Inspect the PDF outline tree with page numbers and export it as Markdown, plain text, or JSON.",
    icon: Bookmark,
    accent: "text-tool-bookmarks",
    accentSoft: "bg-tool-bookmarks/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "attachments",
    slug: "extract-attachments",
    name: "Extract Attachments",
    tagline: "Pull out embedded files",
    description:
      "List every file embedded inside a PDF and download them individually or as a single zip — all on-device.",
    icon: Paperclip,
    accent: "text-tool-attachments",
    accentSoft: "bg-tool-attachments/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "attach",
    slug: "attach-files",
    name: "Attach Files",
    tagline: "Embed any file in a PDF",
    description:
      "Bundle source files, receipts, or screenshots inside a PDF as embedded attachments. Travels with the document.",
    icon: PaperclipIcon,
    accent: "text-tool-attach",
    accentSoft: "bg-tool-attach/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "strip-annotations",
    slug: "strip-annotations",
    name: "Strip Annotations",
    tagline: "Remove every comment & link",
    description:
      "Wipe highlights, sticky notes, link rectangles, form widgets, and stamps. Page text and images stay untouched.",
    icon: MessageSquareOff,
    accent: "text-tool-strip-annot",
    accentSoft: "bg-tool-strip-annot/10",
    accept: "pdf",
    group: "Optimize",
  },
  {
    id: "image-compress",
    slug: "compress-images",
    name: "Compress Images",
    tagline: "Shrink JPGs, PNGs & WebPs",
    description:
      "Bulk-resize and re-encode images to JPG, WebP, or PNG with a quality slider. Perfect for sending and uploading.",
    icon: ImageMinus,
    accent: "text-tool-img-compress",
    accentSoft: "bg-tool-img-compress/10",
    accept: "image",
    group: "Optimize",
  },
  {
    id: "long-image",
    slug: "long-image",
    name: "PDF to Long Image",
    tagline: "All pages in one tall image",
    description:
      "Stitch every page of a PDF into a single vertical PNG or JPG — perfect for chat previews and long-scroll mockups.",
    icon: StretchVertical,
    accent: "text-tool-long-image",
    accentSoft: "bg-tool-long-image/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "smart-combine",
    slug: "smart-combine",
    name: "Smart Combine",
    tagline: "Merge PDFs & images into one PDF",
    description:
      "Mix PDFs, JPGs, PNGs, and WebPs into a single ordered PDF. Drag to reorder; images become full-size pages.",
    icon: Boxes,
    accent: "text-tool-smart-combine",
    accentSoft: "bg-tool-smart-combine/10",
    accept: "image",
    group: "Organize",
  },
  {
    id: "interleave",
    slug: "interleave",
    name: "Interleave PDFs",
    tagline: "Zip two scans together",
    description:
      "Drop two PDFs (e.g. fronts and backs of a duplex scan) and merge them in alternating order — with optional reverse.",
    icon: Shuffle,
    accent: "text-tool-interleave",
    accentSoft: "bg-tool-interleave/10",
    accept: "pdf-multi",
    group: "Organize",
  },
  {
    id: "highlight-search",
    slug: "highlight-search",
    name: "Search & Highlight",
    tagline: "Yellow box every match",
    description:
      "Type a phrase — Folio finds every occurrence in your PDF and paints a soft yellow highlight over each one.",
    icon: Search,
    accent: "text-tool-highlight",
    accentSoft: "bg-tool-highlight/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "page-snapshot",
    slug: "page-snapshot",
    name: "Page Snapshot",
    tagline: "One page → image",
    description:
      "Pick any single page, choose JPG, PNG, or WebP at the resolution you want, and download a crisp image.",
    icon: Camera,
    accent: "text-tool-snapshot",
    accentSoft: "bg-tool-snapshot/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "cover-page",
    slug: "cover-page",
    name: "Add Cover Page",
    tagline: "Front or back cover",
    description:
      "Prepend or append a cover (PDF or image) to any document. Images auto-fit; PDF covers preserve every page.",
    icon: BookCopy,
    accent: "text-tool-cover",
    accentSoft: "bg-tool-cover/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "image-grayscale",
    slug: "image-grayscale",
    name: "Image Recolor",
    tagline: "Grayscale, sepia, duotone",
    description:
      "Convert any batch of JPGs, PNGs, or WebPs to grayscale, sepia, or a deep blue / cream duotone — all locally.",
    icon: Droplets,
    accent: "text-tool-img-gray",
    accentSoft: "bg-tool-img-gray/10",
    accept: "image",
    group: "Convert",
  },
  {
    id: "image-watermark",
    slug: "image-watermark",
    name: "Watermark Images",
    tagline: "Brand every photo",
    description:
      "Stamp any text watermark onto a batch of images with control over opacity, size, position, and tiling.",
    icon: ImagePlus,
    accent: "text-tool-img-wm",
    accentSoft: "bg-tool-img-wm/10",
    accept: "image",
    group: "Edit",
  },
  {
    id: "page-counter",
    slug: "page-counter",
    name: "Page Counter",
    tagline: "Bulk PDF page report",
    description:
      "Drop in a stack of PDFs and get an instant CSV, JSON, or text report of how many pages each one contains.",
    icon: Calculator,
    accent: "text-tool-page-counter",
    accentSoft: "bg-tool-page-counter/10",
    accept: "pdf-multi",
    group: "Organize",
  },
  {
    id: "image-resize",
    slug: "resize-images",
    name: "Resize Images",
    tagline: "Bulk image dimensions",
    description:
      "Resize batches of JPGs, PNGs, and WebPs by fit-within, exact size, or percent — with quality control.",
    icon: MoveDiagonal,
    accent: "text-tool-img-resize",
    accentSoft: "bg-tool-img-resize/10",
    accept: "image",
    group: "Optimize",
  },
  {
    id: "image-rotate",
    slug: "rotate-images",
    name: "Rotate Images",
    tagline: "Rotate & flip in bulk",
    description:
      "Rotate any batch of images by 90/180/270° and mirror them horizontally or vertically — all locally.",
    icon: RefreshCcw,
    accent: "text-tool-img-rotate",
    accentSoft: "bg-tool-img-rotate/10",
    accept: "image",
    group: "Edit",
  },
  {
    id: "image-convert",
    slug: "convert-images",
    name: "Convert Images",
    tagline: "JPG ↔ PNG ↔ WebP",
    description:
      "Convert batches of images between JPG, PNG, and WebP with a quality slider. Bundled into a single ZIP.",
    icon: Replace,
    accent: "text-tool-img-convert",
    accentSoft: "bg-tool-img-convert/10",
    accept: "image",
    group: "Convert",
  },
  {
    id: "borders",
    slug: "borders",
    name: "Page Borders",
    tagline: "Frame every page",
    description:
      "Draw a clean rectangular border on every page with full control over colour, thickness, and inset.",
    icon: SquareDashed,
    accent: "text-tool-borders",
    accentSoft: "bg-tool-borders/10",
    accept: "pdf",
    group: "Edit",
  },
  {
    id: "pdf-to-html",
    slug: "pdf-to-html",
    name: "PDF to HTML",
    tagline: "Web-ready document",
    description:
      "Extract every page into a clean, mobile-friendly HTML file. Choose flowing paragraphs or line-preserving layout.",
    icon: FileCode,
    accent: "text-tool-pdf-html",
    accentSoft: "bg-tool-pdf-html/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "image-crop",
    slug: "crop-images",
    name: "Crop Images",
    tagline: "Bulk aspect-ratio crop",
    description:
      "Crop any batch of images to a fixed aspect ratio with anchor control — square for socials, 16:9 for video.",
    icon: Crop,
    accent: "text-tool-img-crop",
    accentSoft: "bg-tool-img-crop/10",
    accept: "image",
    group: "Edit",
  },
  {
    id: "image-blur",
    slug: "blur-images",
    name: "Blur or Pixelate",
    tagline: "Hide what shouldn't ship",
    description:
      "Apply Gaussian blur or chunky mosaic pixelation to entire batches of images. Great for redacting screenshots.",
    icon: Aperture,
    accent: "text-tool-img-blur",
    accentSoft: "bg-tool-img-blur/10",
    accept: "image",
    group: "Edit",
  },
  {
    id: "csv-to-pdf",
    slug: "csv-to-pdf",
    name: "CSV to PDF",
    tagline: "Spreadsheet to printable",
    description:
      "Drop a .csv file and get a clean, paginated PDF table with bold headers, zebra striping, and auto-fit columns.",
    icon: FileSpreadsheet,
    accent: "text-tool-csv-pdf",
    accentSoft: "bg-tool-csv-pdf/10",
    accept: "image",
    group: "Convert",
  },
  {
    id: "json-to-pdf",
    slug: "json-to-pdf",
    name: "JSON to PDF",
    tagline: "Pretty-printed export",
    description:
      "Paste any JSON and export a syntax-highlighted, monospaced PDF — auto-formatted with your preferred indent.",
    icon: Braces,
    accent: "text-tool-json-pdf",
    accentSoft: "bg-tool-json-pdf/10",
    accept: "pdf",
    group: "Convert",
  },
  {
    id: "page-size",
    slug: "page-size",
    name: "Resize Pages",
    tagline: "A4 ↔ Letter ↔ A3",
    description:
      "Convert any PDF to A4, Letter, A3, A5, Legal, or Tabloid in portrait or landscape — fit, fill, or stretch.",
    icon: Maximize,
    accent: "text-tool-page-size",
    accentSoft: "bg-tool-page-size/10",
    accept: "pdf",
    group: "Organize",
  },
  {
    id: "image-trim",
    slug: "trim-images",
    name: "Trim Image Borders",
    tagline: "Auto-crop white edges",
    description:
      "Detect and strip uniform white or transparent borders from any batch of images — with optional padding.",
    icon: Scissors,
    accent: "text-tool-img-trim",
    accentSoft: "bg-tool-img-trim/10",
    accept: "image",
    group: "Optimize",
  },
  {
    id: "contact-sheet",
    slug: "contact-sheet",
    name: "Contact Sheet",
    tagline: "Many pages, one sheet",
    description:
      "Lay every page of a PDF out in a clean grid — perfect for proofs, thumbnails, and printable overviews.",
    icon: LayoutGrid,
    accent: "text-tool-contact-sheet",
    accentSoft: "bg-tool-contact-sheet/10",
    accept: "pdf",
    group: "Organize",
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
