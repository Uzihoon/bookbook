export function coverSource(book) {
  if (book.coverUrl) {
    try {
      const url = new URL(book.coverUrl);
      if (url.protocol === "https:" && !url.username && !url.password)
        return url.href;
    } catch {}
  }
  return typeof book.cover === "string" && /^[a-z0-9-]+$/i.test(book.cover)
    ? `/covers/${book.cover}.jpg`
    : null;
}
export function createOwnedCopy(details, catalog = null) {
  const title = details.title?.trim(),
    author = details.author?.trim();
  if (!title || !author)
    throw new Error("Please enter a book title and author.");
  return {
    id: crypto.randomUUID(),
    title,
    author,
    owner: "You",
    genre: details.genre || "Other",
    note: details.note?.trim() || "",
    status: details.available ? "available" : "unlisted",
    color: details.color || "#713c4b",
    cover: null,
    catalogId: catalog?.catalogId || null,
    source: catalog?.source || null,
    sourceUrl: catalog?.sourceUrl || null,
    isbn13: catalog?.isbn13 || null,
    isbn10: catalog?.isbn10 || null,
    publisher: catalog?.publisher || "",
    publishedDate: catalog?.publishedDate || null,
    authors: catalog?.authors || [author],
    translators: catalog?.translators || [],
    description: catalog?.description || "",
    coverUrl: catalog ? coverSource(catalog) : null,
  };
}
