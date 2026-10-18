// Driveの共有URLは公式の埋め込みプレビューへ。元ファイルの閲覧権限を維持します。
(function () {
  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  function describe(value) {
    let url;
    try { url = new URL(String(value || "").trim()); } catch (_) { return null; }
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (["drive.google.com", "docs.google.com"].includes(url.hostname)) {
      const id = (url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/) || [])[1] || url.searchParams.get("id");
      if (!id || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) return null;
      const resourceKey = url.searchParams.get("resourcekey");
      const suffix = resourceKey && /^[A-Za-z0-9_-]{1,200}$/.test(resourceKey) ? "?resourcekey=" + encodeURIComponent(resourceKey) : "";
      return { kind: "drive", url: `https://drive.google.com/file/d/${id}/view${suffix}`, previewUrl: `https://drive.google.com/file/d/${id}/preview${suffix}` };
    }
    return { kind: "image", url: url.href };
  }
  function markup(value, title) {
    const media = describe(value);
    if (!media) return "";
    const label = escape(title || "写真");
    if (media.kind === "drive") return `<figure class="notice-media drive-media"><iframe src="${escape(media.previewUrl)}" title="${label}：Driveの写真プレビュー" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe><figcaption><a href="${escape(media.url)}" target="_blank" rel="noopener noreferrer">Driveで写真を開く ↗</a><small>表示できないときは、閲覧権限のあるGoogleアカウントで開いてください。</small></figcaption></figure>`;
    return `<figure class="notice-media"><a href="${escape(media.url)}" target="_blank" rel="noopener noreferrer"><img class="notice-photo" src="${escape(media.url)}" alt="${label}" loading="lazy" referrerpolicy="no-referrer"></a><figcaption><a href="${escape(media.url)}" target="_blank" rel="noopener noreferrer">元の写真を開く ↗</a></figcaption></figure>`;
  }
  window.grade2Media = { describe, markup };
  document.addEventListener("error", event => {
    if (!event.target.matches?.("img.notice-photo")) return;
    event.target.hidden = true;
    const caption = event.target.closest("figure")?.querySelector("figcaption");
    if (caption) caption.prepend(document.createTextNode("写真を読み込めませんでした。 "));
  }, true);
})();
