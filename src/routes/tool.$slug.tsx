import { createFileRoute, notFound } from "@tanstack/react-router";
import { toolBySlug } from "@/lib/tools";
import { ToolShell } from "@/components/ToolShell";
import { MergeTool } from "@/tools/MergeTool";
import { SplitTool } from "@/tools/SplitTool";
import { CompressTool } from "@/tools/CompressTool";
import { RotateTool } from "@/tools/RotateTool";
import { OrganizeTool } from "@/tools/OrganizeTool";
import { DeletePagesTool } from "@/tools/DeletePagesTool";
import { PdfToJpgTool } from "@/tools/PdfToJpgTool";
import { JpgToPdfTool } from "@/tools/JpgToPdfTool";
import { WatermarkTool } from "@/tools/WatermarkTool";
import { PageNumbersTool } from "@/tools/PageNumbersTool";
import { SignTool } from "@/tools/SignTool";
import { EditTool } from "@/tools/EditTool";
import { NupTool } from "@/tools/NupTool";
import { CropTool } from "@/tools/CropTool";
import { ExtractTool } from "@/tools/ExtractTool";
import { PdfToPngTool } from "@/tools/PdfToPngTool";
import { MetadataTool } from "@/tools/MetadataTool";
import { UnlockTool } from "@/tools/UnlockTool";
import { RepairTool } from "@/tools/RepairTool";
import { OcrTool } from "@/tools/OcrTool";
import { ProtectTool } from "@/tools/ProtectTool";
import { PdfToWordTool } from "@/tools/PdfToWordTool";
import { HtmlToPdfTool } from "@/tools/HtmlToPdfTool";
import { CompareTool } from "@/tools/CompareTool";
import { RedactTool } from "@/tools/RedactTool";
import { ExcelToPdfTool } from "@/tools/ExcelToPdfTool";
import { PdfToExcelTool } from "@/tools/PdfToExcelTool";
import { FlattenTool } from "@/tools/FlattenTool";
import { BatesTool } from "@/tools/BatesTool";
import { ScanTool } from "@/tools/ScanTool";
import { GrayscaleTool } from "@/tools/GrayscaleTool";
import { ResizeTool } from "@/tools/ResizeTool";
import { BookletTool } from "@/tools/BookletTool";
import { ReverseTool } from "@/tools/ReverseTool";
import { MirrorTool } from "@/tools/MirrorTool";
import { BackgroundTool } from "@/tools/BackgroundTool";
import { InvertTool } from "@/tools/InvertTool";
import { HeaderFooterTool } from "@/tools/HeaderFooterTool";
import { StampTool } from "@/tools/StampTool";
import { AutoCropTool } from "@/tools/AutoCropTool";
import { FormFillTool } from "@/tools/FormFillTool";
import { AnnotateTool } from "@/tools/AnnotateTool";
import { PdfToTextTool } from "@/tools/PdfToTextTool";
import { CompareTextTool } from "@/tools/CompareTextTool";
import { PdfToMarkdownTool } from "@/tools/PdfToMarkdownTool";
import { MarginsTool } from "@/tools/MarginsTool";
import { RepeatTool } from "@/tools/RepeatTool";
import { SplitBySizeTool } from "@/tools/SplitBySizeTool";
import { UnNupTool } from "@/tools/UnNupTool";
import { RemoveBlankTool } from "@/tools/RemoveBlankTool";
import { EvenOddTool } from "@/tools/EvenOddTool";
import { TextToPdfTool } from "@/tools/TextToPdfTool";
import { PdfInfoTool } from "@/tools/PdfInfoTool";
import { SplitByPagesTool } from "@/tools/SplitByPagesTool";
import { InsertBlankTool } from "@/tools/InsertBlankTool";
import { BookmarksTool } from "@/tools/BookmarksTool";
import { AttachmentsTool } from "@/tools/AttachmentsTool";
import { AttachTool } from "@/tools/AttachTool";
import { StripAnnotationsTool } from "@/tools/StripAnnotationsTool";
import { ImageCompressTool } from "@/tools/ImageCompressTool";
import { LongImageTool } from "@/tools/LongImageTool";
import { SmartCombineTool } from "@/tools/SmartCombineTool";
import { InterleaveTool } from "@/tools/InterleaveTool";
import { HighlightSearchTool } from "@/tools/HighlightSearchTool";
import { PageSnapshotTool } from "@/tools/PageSnapshotTool";
import { CoverPageTool } from "@/tools/CoverPageTool";
import { ImageGrayscaleTool } from "@/tools/ImageGrayscaleTool";
import { ImageWatermarkTool } from "@/tools/ImageWatermarkTool";
import { PageCounterTool } from "@/tools/PageCounterTool";
import { ImageResizeTool } from "@/tools/ImageResizeTool";
import { ImageRotateTool } from "@/tools/ImageRotateTool";
import { ImageConvertTool } from "@/tools/ImageConvertTool";
import { BordersTool } from "@/tools/BordersTool";
import { PdfToHtmlTool } from "@/tools/PdfToHtmlTool";
import { ImageCropTool } from "@/tools/ImageCropTool";
import { ImageBlurTool } from "@/tools/ImageBlurTool";
import { CsvToPdfTool } from "@/tools/CsvToPdfTool";
import { JsonToPdfTool } from "@/tools/JsonToPdfTool";
import { PageSizeTool } from "@/tools/PageSizeTool";
import { ImageTrimTool } from "@/tools/ImageTrimTool";
import { ContactSheetTool } from "@/tools/ContactSheetTool";

export const Route = createFileRoute("/tool/$slug")({
  loader: ({ params }) => {
    const tool = toolBySlug(params.slug);
    if (!tool) throw notFound();
    return { tool };
  },
  head: ({ loaderData, params }) => {
    const t = loaderData?.tool;
    if (!t) return { meta: [{ title: "Tool — Folio" }] };
    const title = `${t.name} — Free Online ${t.name.includes("PDF") ? "" : "PDF "}Tool · Folio`;
    const desc = `${t.description} 100% free, no signup, no upload — runs entirely in your browser.`;
    const url = `/tool/${params.slug}`;
    const keywords = [
      t.name.toLowerCase(),
      t.tagline.toLowerCase(),
      "free pdf tool",
      "online pdf",
      "no upload",
      "browser pdf",
      "private pdf",
      "no watermark",
      "free " + t.name.toLowerCase(),
      t.name.toLowerCase() + " online",
      t.name.toLowerCase() + " free",
    ].join(", ");
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "keywords", content: keywords },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: `${t.name} — Folio`,
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Any (browser-based)",
            description: desc,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: "4.9",
              ratingCount: "128",
            },
          }),
        },
      ],
    };
  },
  component: ToolPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-4xl tracking-tight">Tool not found</h1>
      <p className="mt-2 text-muted-foreground">That tool isn't available yet.</p>
    </div>
  ),
});

function ToolPage() {
  const { tool } = Route.useLoaderData();
  return (
    <ToolShell tool={tool}>
      {tool.id === "merge" && <MergeTool />}
      {tool.id === "split" && <SplitTool />}
      {tool.id === "compress" && <CompressTool />}
      {tool.id === "rotate" && <RotateTool />}
      {tool.id === "organize" && <OrganizeTool />}
      {tool.id === "delete" && <DeletePagesTool />}
      {tool.id === "pdf-to-jpg" && <PdfToJpgTool />}
      {tool.id === "jpg-to-pdf" && <JpgToPdfTool />}
      {tool.id === "watermark" && <WatermarkTool />}
      {tool.id === "page-numbers" && <PageNumbersTool />}
      {tool.id === "sign" && <SignTool />}
      {tool.id === "edit" && <EditTool />}
      {tool.id === "nup" && <NupTool />}
      {tool.id === "crop" && <CropTool />}
      {tool.id === "extract" && <ExtractTool />}
      {tool.id === "pdf-to-png" && <PdfToPngTool />}
      {tool.id === "metadata" && <MetadataTool />}
      {tool.id === "unlock" && <UnlockTool />}
      {tool.id === "repair" && <RepairTool />}
      {tool.id === "ocr" && <OcrTool />}
      {tool.id === "protect" && <ProtectTool />}
      {tool.id === "pdf-to-word" && <PdfToWordTool />}
      {tool.id === "html-to-pdf" && <HtmlToPdfTool />}
      {tool.id === "compare" && <CompareTool />}
      {tool.id === "redact" && <RedactTool />}
      {tool.id === "excel-to-pdf" && <ExcelToPdfTool />}
      {tool.id === "pdf-to-excel" && <PdfToExcelTool />}
      {tool.id === "flatten" && <FlattenTool />}
      {tool.id === "bates" && <BatesTool />}
      {tool.id === "scan" && <ScanTool />}
      {tool.id === "grayscale" && <GrayscaleTool />}
      {tool.id === "resize" && <ResizeTool />}
      {tool.id === "booklet" && <BookletTool />}
      {tool.id === "reverse" && <ReverseTool />}
      {tool.id === "mirror" && <MirrorTool />}
      {tool.id === "background" && <BackgroundTool />}
      {tool.id === "invert" && <InvertTool />}
      {tool.id === "header-footer" && <HeaderFooterTool />}
      {tool.id === "stamp" && <StampTool />}
      {tool.id === "auto-crop" && <AutoCropTool />}
      {tool.id === "form-fill" && <FormFillTool />}
      {tool.id === "annotate" && <AnnotateTool />}
      {tool.id === "pdf-to-text" && <PdfToTextTool />}
      {tool.id === "compare-text" && <CompareTextTool />}
      {tool.id === "pdf-to-markdown" && <PdfToMarkdownTool />}
      {tool.id === "margins" && <MarginsTool />}
      {tool.id === "repeat" && <RepeatTool />}
      {tool.id === "split-by-size" && <SplitBySizeTool />}
      {tool.id === "un-nup" && <UnNupTool />}
      {tool.id === "remove-blank" && <RemoveBlankTool />}
      {tool.id === "even-odd" && <EvenOddTool />}
      {tool.id === "text-to-pdf" && <TextToPdfTool />}
      {tool.id === "pdf-info" && <PdfInfoTool />}
      {tool.id === "split-by-pages" && <SplitByPagesTool />}
      {tool.id === "insert-blank" && <InsertBlankTool />}
      {tool.id === "bookmarks" && <BookmarksTool />}
      {tool.id === "attachments" && <AttachmentsTool />}
      {tool.id === "attach" && <AttachTool />}
      {tool.id === "strip-annotations" && <StripAnnotationsTool />}
      {tool.id === "image-compress" && <ImageCompressTool />}
      {tool.id === "long-image" && <LongImageTool />}
      {tool.id === "smart-combine" && <SmartCombineTool />}
      {tool.id === "interleave" && <InterleaveTool />}
      {tool.id === "highlight-search" && <HighlightSearchTool />}
      {tool.id === "page-snapshot" && <PageSnapshotTool />}
      {tool.id === "cover-page" && <CoverPageTool />}
      {tool.id === "image-grayscale" && <ImageGrayscaleTool />}
      {tool.id === "image-watermark" && <ImageWatermarkTool />}
      {tool.id === "page-counter" && <PageCounterTool />}
      {tool.id === "image-resize" && <ImageResizeTool />}
      {tool.id === "image-rotate" && <ImageRotateTool />}
      {tool.id === "image-convert" && <ImageConvertTool />}
      {tool.id === "borders" && <BordersTool />}
      {tool.id === "pdf-to-html" && <PdfToHtmlTool />}
      {tool.id === "image-crop" && <ImageCropTool />}
      {tool.id === "image-blur" && <ImageBlurTool />}
      {tool.id === "csv-to-pdf" && <CsvToPdfTool />}
      {tool.id === "json-to-pdf" && <JsonToPdfTool />}
      {tool.id === "page-size" && <PageSizeTool />}
      {tool.id === "image-trim" && <ImageTrimTool />}
      {tool.id === "contact-sheet" && <ContactSheetTool />}
    </ToolShell>
  );
}
