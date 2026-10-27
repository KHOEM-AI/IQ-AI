export function searchLibrary(items, { q = '', category = '', tag = '', favorite = '', limit = 50 } = {}) {
  const needle = q.trim().toLowerCase();
  const t = tag.trim().toLowerCase();
  const res = items.filter((m) =>
    (!needle || m.name.toLowerCase().includes(needle) || m.tags.some((x) => x.includes(needle))) &&
    (!category || m.category === category) &&
    (!t || m.tags.includes(t)) &&
    (favorite !== 'true' || m.favorite === true));
  res.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { total: res.length, items: res.slice(0, Math.min(Math.max(+limit || 50, 1), 200)) };
}
