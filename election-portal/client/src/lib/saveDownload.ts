export type SaveDownloadResult =
  | { saved: true }
  | { saved: false; cancelled: true };

type SaveBlobOptions = {
  mimeType: string;
  description: string;
  extension: string;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (blob: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

/**
 * Save a blob via the native save dialog. Resolves with saved:true only after
 * the user confirms Save; cancelled dialogs return saved:false.
 */
export async function saveBlobDownload(
  blob: Blob,
  filename: string,
  options: SaveBlobOptions
): Promise<SaveDownloadResult> {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: options.description,
            accept: { [options.mimeType]: [options.extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true };
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "AbortError" || err.name === "NotAllowedError")
      ) {
        return { saved: false, cancelled: true };
      }
      throw err;
    }
  }

  // Fallback: trigger download but cannot detect cancel — do not treat as saved.
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }

  return { saved: false, cancelled: true };
}

export async function savePdfBlob(blob: Blob, filename: string): Promise<SaveDownloadResult> {
  return saveBlobDownload(blob, filename, {
    mimeType: "application/pdf",
    description: "PDF",
    extension: ".pdf",
  });
}

export async function saveXlsxBlob(blob: Blob, filename: string): Promise<SaveDownloadResult> {
  return saveBlobDownload(blob, filename, {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    description: "Excel",
    extension: ".xlsx",
  });
}
