// Centralized pdf.js worker setup. Import this once before using pdfjs-dist.
import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export { pdfjsLib };
