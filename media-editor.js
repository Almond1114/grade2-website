(function () {
  let working = false;
  const escape = value => escapeHtml(String(value || ""));
  function setValue(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  async function preparePhoto(file) {
    if (file.size > 25 * 1024 * 1024) throw new Error("25MB以下の写真を選んでください。");
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("この画像形式を読み込めません。JPEG・PNG・WebPに変換して選び直してください。")); image.src = objectUrl; });
      const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("写真を処理できません。別のブラウザでお試しください。");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let blob;
      for (const quality of [0.86, 0.68, 0.48]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= 3 * 1024 * 1024) break;
      }
      if (!blob || blob.size > 3 * 1024 * 1024) throw new Error("写真を3MB以下にできませんでした。小さい写真を選んでください。");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("写真を読み込めませんでした。"));
        reader.readAsDataURL(blob);
      });
      return { base64, mimeType: "image/jpeg", name: file.name };
    } finally { URL.revokeObjectURL(objectUrl); }
  }
  function mount(fields) {
    const input = fields.querySelector('[name="画像URL"]');
    if (!input) return;
    const panel = document.createElement("section");
    panel.className = "photo-editor wide";
    panel.setAttribute("aria-label", "写真の添付");
    panel.innerHTML = `<div class="photo-heading"><div><span class="mini-label">Photo / 2-3</span><h3>写真を添付</h3><p>写真はDriveに保存し、URLで表示します。最後に「保存する」を押してください。</p></div><button type="button" class="ghost-btn photo-remove">写真を外す</button></div>
      <div class="photo-tabs" role="tablist" aria-label="写真の選び方"><button type="button" id="photoUploadTab" role="tab" aria-controls="photoUploadPanel" aria-selected="true" data-photo-tab="upload">端末からアップロード</button><button type="button" id="photoClassroomTab" role="tab" aria-controls="photoClassroomPanel" aria-selected="false" data-photo-tab="classroom">Classroomから引用</button></div>
      <div id="photoUploadPanel" role="tabpanel" aria-labelledby="photoUploadTab"><label class="photo-file-label"><span>写真を選ぶ</span><input class="photo-file" type="file" accept="image/*"><small>スマホの写真も選べます。長辺2000px以下・3MB以下のJPEGに変換します。</small></label><label class="photo-share" hidden><input type="checkbox" class="photo-public"><span>この写真を「リンクを知っている全員」に共有する</span></label><p class="photo-permission-note">保存先フォルダの共有範囲を引き継ぎます。2年3組のメンバーに閲覧権限のあるフォルダを使ってください。</p><button type="button" class="submit-btn photo-upload">選んだ写真をDriveに保存</button></div>
      <div id="photoClassroomPanel" role="tabpanel" aria-labelledby="photoClassroomTab" hidden><p>2年3組として登録されたコースの写真を選べます。元ファイルの共有範囲を引き継ぎます。</p><div class="photo-classroom-controls"><label>コース<select class="photo-course"><option value="">接続してコースを取得</option></select></label><label>投稿の種類<select class="photo-source"><option value="announcements">ストリームのお知らせ</option><option value="courseWork">課題</option><option value="courseWorkMaterials">資料</option></select></label></div><button type="button" class="ghost-btn photo-classroom-load">Classroomの写真を読み込む</button><div class="classroom-photo-list"></div><button type="button" class="ghost-btn photo-classroom-more" hidden>次の20件の投稿を確認</button></div>
      <p class="photo-status" role="status" aria-live="polite">先に上部の編集キーを確認してください。Driveの共有URLを直接「画像URL」に貼ることもできます。</p><div class="photo-preview"></div>`;
    fields.appendChild(panel);
    const find = selector => panel.querySelector(selector);
    const status = find(".photo-status");
    const preview = find(".photo-preview");
    let coursesLoaded = false;
    let nextPageToken = "";
    let pageContext = "";
    let photos = [];
    const updatePreview = () => { preview.innerHTML = window.grade2Media.markup(input.value, "添付する写真"); };
    const updateAccess = () => {
      const access = window.grade2Backend.getStatus();
      find(".photo-share").hidden = !access?.allowPublicPhotos;
      status.textContent = !access ? "先に上部の編集キーを確認してください。" : !access.uploadEnabled ? "Drive保存先が未設定です。PHOTO_FOLDER_IDを設定してください。共有URLの直接入力は使えます。" : "写真を選べます。添付後、最後にお知らせを保存してください。";
    };
    function requireAccess() {
      if (!window.grade2Backend.isUnlocked()) { document.getElementById("editorKey")?.focus(); throw new Error("先に上部の編集キーを確認してください。"); }
    }
    async function run(button, task) {
      if (working) return;
      working = true;
      button.disabled = true;
      try { requireAccess(); await task(); }
      catch (error) { status.textContent = error.message; }
      finally { working = false; button.disabled = false; }
    }
    const tabs = Array.from(panel.querySelectorAll("[data-photo-tab]"));
    function activateTab(button) {
        panel.querySelectorAll("[data-photo-tab]").forEach(tab => tab.setAttribute("aria-selected", String(tab === button)));
        tabs.forEach(tab => { tab.tabIndex = tab === button ? 0 : -1; });
        find("#photoUploadPanel").hidden = button.dataset.photoTab !== "upload";
        find("#photoClassroomPanel").hidden = button.dataset.photoTab !== "classroom";
    }
    tabs.forEach((button, index) => {
      button.tabIndex = index === 0 ? 0 : -1;
      button.addEventListener("click", () => activateTab(button));
      button.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length];
        activateTab(next);
        next.focus();
      });
    });
    find(".photo-remove").onclick = () => { if (working) return; setValue(input, ""); updatePreview(); status.textContent = "写真を外しました。お知らせを保存すると反映されます。Driveの元ファイルは残ります。"; };
    input.addEventListener("input", updatePreview);
    find(".photo-upload").onclick = event => run(event.currentTarget, async () => {
      if (!window.grade2Backend.getStatus().uploadEnabled) throw new Error("Apps ScriptにPHOTO_FOLDER_IDを設定してください。");
      const file = find(".photo-file").files[0];
      if (!file) throw new Error("先に写真を選んでください。");
      status.textContent = "写真を整えています…";
      const payload = await preparePhoto(file);
      status.textContent = "Driveに保存しています…";
      const result = await window.grade2Backend.request("uploadPhoto", { ...payload, sharing: find(".photo-public").checked ? "link" : "inherit" });
      setValue(input, result.file.url);
      updatePreview();
      status.textContent = "Driveに保存しました。最後に「保存する」を押すとお知らせに掲載されます。";
    });
    async function loadPhotos(append) {
      if (!window.grade2Backend.getStatus().classroomEnabled) throw new Error("Classroomが未設定です。CLASSROOM_COURSE_IDSとClassroomサービスを設定してください。");
      status.textContent = "Classroomに接続しています…";
      if (!coursesLoaded) {
        const result = await window.grade2Backend.request("classroomCourses");
        if (!result.courses.length) throw new Error(result.warnings?.[0] || "引用できるコースがありません。");
        find(".photo-course").innerHTML = result.courses.map(course => `<option value="${escape(course.id)}">${escape(course.name)} ${escape(course.section)}</option>`).join("");
        coursesLoaded = true;
      }
      const courseId = find(".photo-course").value;
      const source = find(".photo-source").value;
      const context = courseId + ":" + source;
      const result = await window.grade2Backend.request("classroomPhotos", { courseId, source, pageToken: append && pageContext === context ? nextPageToken : "" });
      if (!append || pageContext !== context) photos = [];
      pageContext = context;
      photos.push(...result.photos);
      nextPageToken = result.nextPageToken;
      find(".photo-classroom-more").hidden = !nextPageToken;
      find(".classroom-photo-list").innerHTML = photos.length ? photos.map((photo, index) => `<article class="classroom-photo-choice"><div><strong>${escape(photo.name)}</strong><small>${escape(photo.sourceTitle)}</small><a href="${escape(photo.url)}" target="_blank" rel="noopener noreferrer">元の写真を確認 ↗</a></div><button class="ghost-btn" type="button" data-use-photo="${index}">この写真を引用</button></article>`).join("") : emptyState("この20件の投稿には写真がありません。投稿の種類を変えるか、次の20件を確認してください。");
      status.textContent = `${photos.length}枚の写真が見つかりました。${result.skipped ? "権限を確認できないファイルは省略しました。" : ""}${nextPageToken ? "さらに投稿を確認できます。" : ""}`;
    }
    find(".photo-classroom-load").onclick = event => run(event.currentTarget, () => loadPhotos(false));
    find(".photo-classroom-more").onclick = event => run(event.currentTarget, () => loadPhotos(true));
    for (const selector of [".photo-course", ".photo-source"]) find(selector).addEventListener("change", () => {
      nextPageToken = ""; photos = []; find(".classroom-photo-list").innerHTML = ""; find(".photo-classroom-more").hidden = true;
      status.textContent = "条件を変えました。「Classroomの写真を読み込む」を押してください。";
    });
    find(".classroom-photo-list").onclick = event => {
      const button = event.target.closest("[data-use-photo]");
      if (!button || working) return;
      const photo = photos[Number(button.dataset.usePhoto)];
      if (!photo) return;
      setValue(input, photo.url);
      const sourceInput = fields.querySelector('[name="リンクURL"]');
      if (sourceInput) setValue(sourceInput, photo.sourceUrl);
      updatePreview();
      status.textContent = "写真と引用元の投稿リンクを添付しました。内容を確認し、お知らせを保存してください。";
    };
    updateAccess();
    updatePreview();
  }
  window.grade2PhotoEditor = { mount, isBusy: () => working };
  window.addEventListener("grade2:editor-unlocked", () => {
    const fields = document.getElementById("editFields");
    if (fields?.querySelector(".photo-editor")) {
      fields.querySelector(".photo-editor").remove();
      mount(fields);
    }
  });
})();
