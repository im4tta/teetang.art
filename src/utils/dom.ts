/**
 * Scrolls `item` into view within its nearest horizontally scrolling ancestor
 * only. Element.scrollIntoView would also scroll every vertical container up
 * the tree, e.g. jumping the phone settings sheet away from its top.
 */
export function revealHorizontally(
  item: HTMLElement | null | undefined,
  align: "start" | "center" = "start",
): void {
  let row = item?.parentElement ?? null;
  while (
    row &&
    !(row.scrollWidth > row.clientWidth && /auto|scroll/.test(getComputedStyle(row).overflowX))
  ) {
    row = row.parentElement;
  }
  if (!item || !row) return;
  const rowBox = row.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  const inset = align === "center" ? (rowBox.width - itemBox.width) / 2 : 0;
  row.scrollLeft += itemBox.left - rowBox.left - inset;
}
