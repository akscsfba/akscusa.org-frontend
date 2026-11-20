/**
 * In-page filtering for an editorial index.
 *
 * The blog and the interventions index used to publish a route per term —
 * `/blog/category/<id>/`, `/interventions/kind/<id>/`. A vocabulary grows, and
 * each new term added a listing that repeated the index it was cut from, so
 * the sitemap filled with near-empty pages nobody had asked for. One index that
 * narrows itself replaces all of them, and the query string keeps a narrowed
 * view linkable.
 *
 * The markup contract is set by `EditorialIndex.astro`:
 *
 * - the root carries `data-index-filter="<query key>"`;
 * - `[data-filter-controls]` wraps the chips and sits with the entries it
 *   filters, so a press changes something the reader can see;
 * - each chip is a `button[data-filter-value]`, where `all` clears the filter;
 * - each card carries `data-filter-term`; the lead band also carries the
 *   attribute for context but is never hidden;
 * - `[data-filter-status]` announces the archive-only count beside the controls,
 *   worded by `data-count-one` and `data-count-other`; the masthead total is fixed;
 * - `[data-filter-lead-note]` explains why the lead stays visible.
 */

const ALL_TERMS = "all";

const setHidden = (element: HTMLElement, hidden: boolean) => {
  element.hidden = hidden;
};

const enhanceIndex = (root: HTMLElement) => {
  const key = root.dataset.indexFilter;

  if (!key || root.dataset.indexFilterReady !== undefined) {
    return;
  }

  const controls = root.querySelector<HTMLElement>("[data-filter-controls]");
  const chips = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-filter-value]"),
  ];
  const entries = [
    ...root.querySelectorAll<HTMLElement>(
      "[data-filter-term]:not([data-filter-lead])",
    ),
  ];
  const status = root.querySelector<HTMLElement>("[data-filter-status]");
  const lead = root.querySelector<HTMLElement>("[data-filter-lead]");
  const leadNote = root.querySelector<HTMLElement>("[data-filter-lead-note]");

  if (!controls || !status || chips.length === 0 || entries.length === 0) {
    return;
  }

  const apply = (term: string) => {
    const selected = chips.find((chip) => chip.dataset.filterValue === term);
    if (!selected) throw new Error(`Unknown editorial filter: ${term}`);
    let shown = 0;

    for (const entry of entries) {
      const matches = term === ALL_TERMS || entry.dataset.filterTerm === term;
      setHidden(entry, !matches);

      if (matches) {
        shown += 1;
      }
    }

    const noun =
      shown === 1
        ? (root.dataset.countOne ?? "entry")
        : (root.dataset.countOther ?? "entries");
    const scope = lead ? "earlier " : "";
    const category =
      term === ALL_TERMS ? "" : ` in ${selected.textContent?.trim()}`;
    status.textContent =
      shown === 0
        ? `No ${scope}${noun}${category}. Choose another filter or show all.`
        : `${shown} ${scope}${noun}${category}.`;

    for (const chip of chips) {
      chip.setAttribute(
        "aria-pressed",
        String(chip.dataset.filterValue === term),
      );
    }
  };

  const known = new Set(chips.map((chip) => chip.dataset.filterValue));

  const select = (term: string, pushToUrl: boolean) => {
    apply(term);

    if (!pushToUrl) {
      return;
    }

    const url = new URL(window.location.href);

    if (term === ALL_TERMS) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, term);
    }

    // Replaced rather than pushed. A filter is a way of looking at one page,
    // not a place; pushing would make Back walk chip by chip out of the index
    // instead of returning to wherever the reader came from.
    window.history.replaceState(null, "", url);
  };

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      select(chip.dataset.filterValue ?? ALL_TERMS, true);
    });
  }

  // A shared or bookmarked link opens narrowed. An unrecognised term — a
  // retired category, a typo — falls back to the whole index rather than to an
  // empty one.
  const requested = new URLSearchParams(window.location.search).get(key);
  select(requested && known.has(requested) ? requested : ALL_TERMS, false);
  root.dataset.indexFilterReady = "";
  controls.hidden = false;
  if (leadNote) leadNote.hidden = false;
};

export const mountIndexFilters = (): void => {
  document
    .querySelectorAll<HTMLElement>("[data-index-filter]")
    .forEach(enhanceIndex);
};
