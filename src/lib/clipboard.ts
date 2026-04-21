/**
 * Copy text to the clipboard when the text itself resolves asynchronously.
 *
 * Safari requires `navigator.clipboard.write()` to be called synchronously
 * within a user gesture — any awaited work beforehand expires the user
 * activation and the write is silently rejected. It uniquely allows a
 * `Promise<Blob>` as the value of a `ClipboardItem`, so we can initiate the
 * write immediately while the text is still being fetched/generated.
 *
 * Must be invoked synchronously from a user gesture handler — do not await
 * anything before calling it.
 */
export function copyTextViaPromise(textPromise: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const blobPromise = textPromise.then(
      (text) => new Blob([text], { type: "text/plain" }),
    );
    try {
      const item = new ClipboardItem({ "text/plain": blobPromise });
      return navigator.clipboard.write([item]);
    } catch {
      // Fall through to writeText for browsers that reject Promise values
      // in ClipboardItem.
    }
  }
  return textPromise.then((text) => navigator.clipboard.writeText(text));
}
