(function () {
  let working = false;
  let refreshAccess = () => {};
  let disposeCurrent = () => {};
  let readState = () => null;
  function dispose() {
    disposeCurrent();
    disposeCurrent = () => {};
    readState = () => null;
    refreshAccess = () => {};
  }
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
  function mount(fields, state = {}, options = {}) {
    const input = fields.querySelector('[name="画像URL"]');
    if (!input) return;
    dispose();
    const isTimetable = options.purpose === "timetablePhotos";
    let selectedFile = state?.file || null;
    let activeTab = state?.tab || (isTimetable && !selectedFile ? "classroom" : "upload");
    let localUrl = "";
    const sourceInput = fields.querySelector('[name="リンクURL"]');
    let citation = state?.citation || null;
    if (!citation && input.value && sourceInput?.value) {
      try { if (new URL(sourceInput.value).hostname === "classroom.google.com") citation = { imageUrl: input.value, sourceUrl: sourceInput.value }; } catch (_) {}
    }
    function clearAutomaticCitation() {
      const previous = citation;
      citation = null;
      if (previous && sourceInput?.value === previous.sourceUrl) setValue(sourceInput, "");
    }
    const panel = document.createElement("section");
    panel.className = "photo-editor wide";
    panel.setAttribute("aria-label", "写真の添付");
    panel.innerHTML = `<div class="photo-heading"><div><span class="mini-label">Photo / 2-3</span><h3>${isTimetable ? "時間割の写真を選ぶ" : "写真を添付"}</h3><p>端末の写真はDriveに保存し、Classroomの写真は元ファイルのURLを引用します。最後に「保存する」を押してください。</p></div><button type="button" class="ghost-btn photo-remove">写真を外す</button></div>
      <div class="photo-tabs" role="tablist" aria-label="写真の選び方"><button type="button" id="photoUploadTab" role="tab" aria-controls="photoUploadPanel" aria-selected="true" data-photo-tab="upload">端末からアップロード</button><button type="button" id="photoClassroomTab" role="tab" aria-controls="photoClassroomPanel" aria-selected="false" data-photo-tab="classroom">Classroomから引用</button></div>
      <div id="photoUploadPanel" role="tabpanel" aria-labelledby="photoUploadTab"><label class="photo-file-label"><span>写真を選ぶ</span><input class="photo-file" type="file" accept="image/*"><small>スマホの写真も選べます。長辺2000px以下・3MB以下のJPEGに変換します。</small></label><label class="photo-share" hidden><input type="checkbox" class="photo-public"><span>この写真を「リンクを知っている全員」に共有する</span></label><p class="photo-permission-note">保存先フォルダの共有範囲を引き継ぎます。2年3組のメンバーに閲覧権限のあるフォルダを使ってください。</p><button type="button" class="submit-btn photo-upload">選んだ写真をDriveに保存</button></div>
      <div id="photoClassroomPanel" role="tabpanel" aria-labelledby="photoClassroomTab" hidden><p>2年3組として登録されたコースの写真を選べます。元ファイルの共有範囲を引き継ぎます。</p><div class="photo-classroom-controls"><label>コース<select class="photo-course"><option value="">接続してコースを取得</option></select></label><label>投稿の種類<select class="photo-source"><option value="announcements">ストリームのお知らせ</option><option value="courseWork">課題</option><option value="courseWorkMaterials">資料</option></select></label></div><label class="photo-search-label">写真の名前・投稿名で絞り込む<input type="search" class="photo-classroom-search" placeholder="時間割、週予定、日付など" aria-describedby="photoSearchHelp"><small id="photoSearchHelp">読み込んだ写真の名前・投稿名を検索します。「時間割」では週予定・週案・日課表も候補に含めます。空欄で全件表示。</small></label><button type="button" class="ghost-btn photo-classroom-load">Classroomの写真を読み込む</button><p class="photo-classroom-count" role="status" aria-live="polite"></p><div class="classroom-photo-list"></div><button type="button" class="ghost-btn photo-classroom-more" hidden>次の20件の投稿を確認</button></div>
      <p class="photo-status" role="status" aria-live="polite">先に上部の編集キーを確認してください。Driveの共有URLを直接「画像URL」に貼ることもできます。</p><div class="photo-preview"></div>`;
    fields.appendChild(panel);
    const find = selector => panel.querySelector(selector);
    const status = find(".photo-status");
    const searchInput = find(".photo-classroom-search");
    searchInput.value = state?.query ?? (isTimetable ? "時間割" : "");
    const preview = find(".photo-preview");
    const fileInput = find(".photo-file");
    const selection = document.createElement("p");
    selection.className = "photo-selection";
    selection.id = "photoSelectionStatus";
    fileInput.setAttribute("aria-describedby", selection.id);
    fileInput.closest("label").after(selection);
    const localPreview = document.createElement("div");
    localPreview.className = "photo-local-preview";
    localPreview.hidden = true;
    localPreview.innerHTML = '<strong>アップロード前の写真</strong><img alt="選択した写真の確認"><small>この写真はまだDriveに保存されていません。</small><button type="button" class="ghost-btn photo-selection-clear">選択を解除</button>';
    selection.after(localPreview);
    const releaseLocalUrl = () => { if (localUrl) URL.revokeObjectURL(localUrl); localUrl = ""; };
    function showSelection() {
      releaseLocalUrl();
      localPreview.hidden = !selectedFile;
      selection.textContent = selectedFile ? `選択中：${selectedFile.name}（${(selectedFile.size / 1024 / 1024).toFixed(1)} MB）` : "写真はまだ選択されていません。";
      if (selectedFile) {
        localUrl = URL.createObjectURL(selectedFile);
        localPreview.querySelector("img").src = localUrl;
      } else { localPreview.querySelector("img").removeAttribute("src"); }
    }
    function clearSelection() { selectedFile = null; fileInput.value = ""; showSelection(); }
    localPreview.querySelector(".photo-selection-clear").onclick = () => {
      if (working) return;
      clearSelection();
      // クリックだけではフォームのchangeは起きないので、下書き側にも解除を伝える。
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      status.textContent = "端末の写真の選択を解除しました。フォームの画像URLはそのままです。";
    };
    fileInput.addEventListener("change", () => {
      selectedFile = fileInput.files[0] || null;
      if (selectedFile && (selectedFile.size > 25 * 1024 * 1024 || (selectedFile.type && !selectedFile.type.startsWith("image/")))) {
        clearSelection();
        status.textContent = "25MB以下の画像ファイルを選んでください。";
        return;
      }
      showSelection();
      status.textContent = selectedFile ? "送信前の写真を確認してください。「Driveに保存」を押すまでアップロードされません。" : "写真の選択を解除しました。";
    });
    disposeCurrent = releaseLocalUrl;
    readState = () => panel.isConnected ? { file: selectedFile, sharing: find(".photo-public").checked, citation, query: searchInput.value, tab: activeTab } : null;
    let coursesLoaded = false;
    let nextPageToken = "";
    let pageContext = "";
    let photos = [];
    let photosLoaded = false;
    const updatePreview = () => {
      const markup = window.grade2Media.markup(input.value, "添付する写真");
      preview.innerHTML = markup ? `<h4>${isTimetable ? "掲載する時間割の写真" : "添付する写真"}</h4>` + markup : "";
    };
    const updateAccess = () => {
      const access = window.grade2Backend.getStatus();
      find(".photo-share").hidden = !access?.allowPublicPhotos;
      if (!access?.allowPublicPhotos) find(".photo-public").checked = false;
      status.textContent = !access ? "先に上部の編集キーを確認してください。" : !access.uploadEnabled ? (access.classroomEnabled ? "端末からのアップロード先は未設定です。Classroomからの引用と共有URLの直接入力は使えます。" : "写真サービスは未接続です。管理者の設定後に使えます。共有URLの直接入力もできます。") : "写真を選べます。添付後、最後に「保存する」を押してください。";
    };
    function requireAccess() {
      if (!window.grade2Backend.isUnlocked()) { document.getElementById("editorKey")?.focus(); throw new Error("先に上部の編集キーを確認してください。"); }
    }
    async function run(button, task) {
      if (working) return;
      working = true;
      panel.setAttribute("aria-busy", "true");
      const controls = Array.from(panel.querySelectorAll("button,input,select"));
      const disabled = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      try { requireAccess(); await task(); }
      catch (error) { status.textContent = error.message; }
      finally {
        working = false;
        panel.setAttribute("aria-busy", "false");
        controls.forEach((control, index) => { control.disabled = disabled[index]; });
      }
    }
    const tabs = Array.from(panel.querySelectorAll("[data-photo-tab]"));
    function activateTab(button) {
        activeTab = button.dataset.photoTab;
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
    activateTab(tabs.find(tab => tab.dataset.photoTab === activeTab) || tabs[0]);
    find(".photo-remove").onclick = () => { if (working) return; clearSelection(); clearAutomaticCitation(); setValue(input, ""); updatePreview(); status.textContent = "写真を外しました。「保存する」を押すと反映されます。Driveの元ファイルは残ります。"; };
    input.addEventListener("input", updatePreview);
    find(".photo-upload").onclick = event => run(event.currentTarget, async () => {
      if (!window.grade2Backend.getStatus().uploadEnabled) throw new Error("Apps ScriptにPHOTO_FOLDER_IDを設定してください。");
      const file = selectedFile;
      if (!file) throw new Error("先に写真を選んでください。");
      status.textContent = "写真を整えています…";
      const payload = await preparePhoto(file);
      status.textContent = "Driveに保存しています…";
      const result = await window.grade2Backend.request("uploadPhoto", { ...payload, sharing: find(".photo-public").checked ? "link" : "inherit" });
      clearSelection();
      clearAutomaticCitation();
      setValue(input, result.file.url);
      updatePreview();
      status.textContent = "Driveに保存しました。最後に「保存する」を押すとサイトに掲載されます。";
    });
    function renderPhotos() {
      if (!photosLoaded) return;
      const matches = new Set(window.grade2Media.filterPhotos(photos, searchInput.value));
      find(".photo-classroom-count").textContent = `読み込んだ写真 ${photos.length}枚 / 候補 ${matches.size}枚`;
      find(".classroom-photo-list").innerHTML = matches.size ? photos.map((photo, index) => matches.has(photo) ? `<article class="classroom-photo-choice"><div><strong>${escape(photo.name)}</strong><small>${escape(photo.sourceTitle)}</small><a href="${escape(photo.url)}" target="_blank" rel="noopener noreferrer">元の写真を確認 ↗</a></div><button class="ghost-btn" type="button" data-use-photo="${index}">この写真を引用</button></article>` : "").join("") : emptyState(photos.length ? "条件に合う写真がありません。検索欄を空にするか、投稿の種類を変えて読み込んでください。続きがある場合は次の20件も確認できます。" : "読み込んだ投稿には写真がありません。投稿の種類を変えるか、続きの投稿を確認してください。");
    }
    searchInput.addEventListener("input", renderPhotos);
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
      photosLoaded = true;
      nextPageToken = result.nextPageToken;
      find(".photo-classroom-more").hidden = !nextPageToken;
      renderPhotos();
      status.textContent = `${photos.length}枚の写真が見つかりました。${result.skipped ? "権限を確認できないファイルは省略しました。" : ""}${nextPageToken ? "さらに投稿を確認できます。" : ""}`;
    }
    find(".photo-classroom-load").onclick = event => run(event.currentTarget, () => loadPhotos(false));
    find(".photo-classroom-more").onclick = event => run(event.currentTarget, () => loadPhotos(true));
    for (const selector of [".photo-course", ".photo-source"]) find(selector).addEventListener("change", () => {
      nextPageToken = ""; photos = []; photosLoaded = false; find(".classroom-photo-list").innerHTML = ""; find(".photo-classroom-count").textContent = ""; find(".photo-classroom-more").hidden = true;
      status.textContent = "条件を変えました。「Classroomの写真を読み込む」を押してください。";
    });
    find(".classroom-photo-list").onclick = event => {
      const button = event.target.closest("[data-use-photo]");
      if (!button || working) return;
      const photo = photos[Number(button.dataset.usePhoto)];
      if (!photo) return;
      clearSelection();
      setValue(input, photo.url);
      citation = photo.sourceUrl ? { imageUrl: photo.url, sourceUrl: photo.sourceUrl } : null;
      if (sourceInput) setValue(sourceInput, photo.sourceUrl || "");
      const titleInput = fields.querySelector('[name="タイトル"]');
      if (isTimetable && titleInput && !titleInput.value.trim()) setValue(titleInput, photo.sourceTitle || photo.name || "時間割");
      updatePreview();
      status.textContent = "写真と引用元の投稿リンクを添付しました。内容を確認し、最後に「保存する」を押してください。";
    };
    find(".photo-public").checked = !!state?.sharing;
    updateAccess();
    showSelection();
    refreshAccess = () => { if (panel.isConnected) updateAccess(); };
    updatePreview();
  }
  window.grade2PhotoEditor = { mount, dispose, snapshot: () => readState(), isBusy: () => working };
  // 接続状態だけを変え、選択した写真や入力済みのURLは保持する。
  window.addEventListener("grade2:editor-unlocked", () => refreshAccess());
  window.addEventListener("grade2:editor-locked", () => refreshAccess());
})();
