export function mountEditorDisplay(
  panel: HTMLDialogElement,
  toggle: HTMLButtonElement,
  editor: HTMLIFrameElement,
): () => void {
  const innerLayerSelector = CSS.supports("selector(:popover-open)")
    ? ":modal, :popover-open"
    : ":modal";

  function resize(expanded: boolean, restoreFocus = true) {
    if (panel.matches(":modal") === expanded) return;

    // Keep the iframe connected: moving or replacing it would discard edits.
    panel.close();
    if (expanded) panel.showModal();
    else panel.show();

    toggle.textContent = expanded ? "Exit full screen" : "Full screen";
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener("click", () => resize(!panel.matches(":modal")));
  panel.addEventListener("cancel", (event) => {
    event.preventDefault();
    resize(false);
  });
  // Escape in an iframe does not reach the parent dialog. Give the editor's
  // own keyboard handlers and nested dialogs the first chance to consume it.
  editor.addEventListener("load", () => {
    editor.contentDocument?.defaultView?.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !== "Escape" ||
          event.isComposing ||
          event.defaultPrevented ||
          !panel.matches(":modal") ||
          editor.contentDocument?.querySelector(innerLayerSelector)
        )
          return;
        window.setTimeout(() => {
          if (!event.defaultPrevented) resize(false);
        }, 0);
      },
    );
  });

  return () => resize(false, false);
}
