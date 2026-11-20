import { enhanceDisclosure } from "~/components/navigation/nav-disclosure";

export function mountTopicMenu(): void {
  const menu = document.querySelector<HTMLDetailsElement>("[data-topic-menu]");
  const content = document.querySelector<HTMLElement>(".testimonies-content");
  if (!menu || !content) return;

  const summary = menu.querySelector("summary");
  if (!summary) throw new Error("The testimony topic menu needs a summary.");

  enhanceDisclosure(menu, { closeAt: "(min-width: 64rem)" });

  const updateOffset = () => {
    const style = getComputedStyle(menu);
    // Measure the closed chrome even while its list of topics is expanded.
    const closedHeight =
      summary.getBoundingClientRect().bottom -
      menu.getBoundingClientRect().top +
      Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderBottomWidth);
    const gap = Number.parseFloat(getComputedStyle(content).fontSize);
    content.style.setProperty(
      "--testimony-scroll-offset",
      `${Number.parseFloat(style.top) + closedHeight + gap}px`,
    );
  };

  updateOffset();
  new ResizeObserver(updateOffset).observe(summary);
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.open = false;
    });
  });
}
