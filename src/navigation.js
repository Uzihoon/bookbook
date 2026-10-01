const paths = { shelf: "/", picks: "/monthly-picks", loans: "/borrowing" };
export function pathForPage(page) {
  return paths[page] || "/";
}
export function pageForPath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return Object.keys(paths).find((page) => paths[page] === path) || "shelf";
}
