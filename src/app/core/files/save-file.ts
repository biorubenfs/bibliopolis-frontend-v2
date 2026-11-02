/** Triggers a browser download for an in-memory file. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Give the browser time to start the download before releasing the object URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
