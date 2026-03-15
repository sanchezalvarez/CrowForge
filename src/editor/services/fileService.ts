/**
 * Re-exports file service functions used by the editor.
 * The actual implementation lives in lib/fileService.ts.
 */

export {
  validateImportFile,
  parseDocumentImport,
  exportDocumentAs,
  exportDocumentsAsZip,
  DOCUMENT_IMPORT_ACCEPT,
  DOCUMENT_IMPORT_EXTS,
  DOCUMENT_EXPORT_FORMATS,
  type DocExportFormat,
} from "../../lib/fileService";
