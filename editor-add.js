// 2Base 2年3組版の追加・編集画面。
(function () {
  let saving = false;
  let dirty = false;
  let renderedKey = "";
  const drafts = new Map();
  const savedRows = new Map();
  const currentKey = () => selectedEditType + ":" + selectedRowNumber;
  const mode = () => selectedRowNumber === "__new__" ? "add" : "update";
  const busy = () => saving || !!window.grade2PhotoEditor?.isBusy();
  function rememberDraft() {
    if (saving || !renderedKey || renderedKey !== currentKey() || !selectedEditRow()) return;
    const photo = window.grade2PhotoEditor?.snapshot();
    if (!dirty && !photo?.file) return;
    drafts.set(renderedKey, { values: Object.fromEntries(new FormData($("editForm"))), photo });
  }
  function blankRow(type) {
    const row = { __rowNumber: "" };
    (EDIT_FIELDS[type] || []).forEach(([name]) => { row[name] = ""; });
    if ("表示" in row) row.表示 = "TRUE";
    if ("クラス" in row) row.クラス = CLASS_ID;
    if ("日付" in row && type !== "items") row.日付 = dateKey(new Date());
    if (type === "announcements") row.カテゴリ = "連絡";
    if (type === "timetable") row.曜日 = "月";
    if (type === "homework") row.締切 = dateKey(new Date());
    if (type === "links") row.カテゴリ = "学習";
    return row;
  }
  function choose(type, rowNumber) {
    if (busy()) { if ($("editTypeSelect")) $("editTypeSelect").value = selectedEditType; return; }
    rememberDraft();
    selectedEditType = type;
    selectedRowNumber = rowNumber;
    dirty = false;
    renderedKey = "";
    renderEditor();
    $("editForm")?.closest(".editor-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  selectedEditRow = function () {
    return mode() === "add" ? blankRow(selectedEditType) : savedRows.get(currentKey()) || (appData[selectedEditType] || []).find(row => row.__rowNumber === selectedRowNumber) || null;
  };
  renderEditor = function () {
    if (!document.body.matches('[data-page="edit"]')) return;
    renderEditTypeCards();
    const select = $("editTypeSelect");
    select.innerHTML = EDIT_TYPE_ORDER.map(type => `<option value="${type}" ${type === selectedEditType ? "selected" : ""}>${escapeHtml(TYPE_LABELS[type])}</option>`).join("");
    renderEditRowList();
    renderEditForm();
    renderEditLog();
  };
  renderEditTypeCards = function () {
    const box = $("editTypeCards");
    if (!box) return;
    box.innerHTML = EDIT_TYPE_ORDER.map(type => {
      const meta = EDIT_TYPE_META[type];
      return `<button class="edit-type-card editor-menu-card ${mode() === "add" && type === selectedEditType ? "active" : ""}" data-add-type="${type}" type="button"><span class="edit-type-icon">${meta.icon}</span><span class="edit-type-copy"><strong>${escapeHtml(TYPE_LABELS[type])}を追加</strong><span>${escapeHtml(meta.short)}</span><small>2年3組の新しい内容を登録</small><b class="mobile-add-btn">タップして追加フォームを開く</b></span><em>追加</em></button>`;
    }).join("");
    // clickだけでタッチとマウスに対応。touchendの二重発火で入力を消さない。
    box.onclick = event => {
      const button = event.target.closest("[data-add-type]");
      if (button) choose(button.dataset.addType, "__new__");
    };
  };
  renderEditRowList = function () {
    const list = $("editRowList");
    if (!list) return;
    const rows = rowsForEdit();
    list.innerHTML = rows.length ? rows.map(row => {
      const summary = selectedEditType === "timetable" ? PERIODS.slice(0, 3).map(period => row[period]).filter(Boolean).join("・") : row.本文 || row.内容 || row.範囲 || row.持ち物 || row.説明 || row.メモ || "";
      return `<button type="button" class="edit-row ${row.__rowNumber === selectedRowNumber ? "active" : ""}" data-row="${escapeHtml(row.__rowNumber)}"><span>${escapeHtml(rowTitle(selectedEditType, row))}</span><small>${escapeHtml(TYPE_LABELS[selectedEditType])} / ${escapeHtml(row.クラス || CLASS_ID)}</small>${summary ? `<p>${escapeHtml(String(summary).slice(0, 90))}</p>` : ""}</button>`;
    }).join("") : emptyState("まだ内容がないか、検索条件に一致しません。上のカードから追加できます。");
    list.onclick = event => {
      const button = event.target.closest("[data-row]");
      if (button) choose(selectedEditType, button.dataset.row);
    };
  };
  function buildFields(row) {
    return EDIT_FIELDS[selectedEditType].map(([name, type, choices]) => {
      const value = name === "クラス" ? CLASS_ID : row[name] || "";
      const help = fieldHelpText(name, selectedEditType);
      const label = `<span>${escapeHtml(name)}</span>`;
      if (type === "select") return `<label>${label}<select name="${escapeHtml(name)}">${choices.map(choice => `<option value="${escapeHtml(choice)}" ${choice === value ? "selected" : ""}>${escapeHtml(choice)}</option>`).join("")}</select>${help}</label>`;
      if (type === "textarea") return `<label class="wide">${label}<textarea name="${escapeHtml(name)}" rows="4">${escapeHtml(value)}</textarea>${help}</label>`;
      return `<label>${label}<input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${name === "クラス" ? "readonly" : ""}>${help}</label>`;
    }).join("");
  }
  renderEditForm = function (force = false) {
    const form = $("editForm");
    const fields = $("editFields");
    if (!form || !fields || busy()) return;
    const key = selectedEditType + ":" + selectedRowNumber;
    if (!force && key === renderedKey && dirty) return;
    renderedKey = key;
    const draft = drafts.get(key);
    dirty = !!draft;
    const row = selectedEditRow();
    $("editMode").value = mode();
    document.body.dataset.editorMode = mode();
    if (!row) {
      window.grade2PhotoEditor?.dispose();
      $("editFormTitle").textContent = "追加するカード、または編集する内容を選んでください";
      fields.innerHTML = emptyState("写真の連絡は「お知らせを追加」、Classroomの時間割は「時間割の写真を追加」を選んでください。");
      $("formStatus").textContent = "上のカードから追加、一覧から編集できます。";
      return;
    }
    $("editFormTitle").textContent = mode() === "add" ? `新しく追加：${TYPE_LABELS[selectedEditType]}` : rowTitle(selectedEditType, row);
    window.grade2PhotoEditor?.dispose();
    fields.innerHTML = `<div class="edit-current-preview wide"><span>${EDIT_TYPE_META[selectedEditType].icon} ${mode() === "add" ? "新規追加" : "編集中"}</span><strong>2年3組 / ${escapeHtml(TYPE_LABELS[selectedEditType])}</strong><small>${mode() === "add" ? "保存するとサイトに新しく追加されます。" : "内容を直したら保存してください。"}</small></div>` + buildFields({ ...row, ...draft?.values });
    if (EDIT_FIELDS[selectedEditType].some(([name]) => name === "画像URL")) window.grade2PhotoEditor?.mount(fields, draft?.photo, { purpose: selectedEditType });
    $("formStatus").textContent = draft ? "下書きを戻しました。内容と写真を確認して保存してください。" : "内容を入力して保存してください。写真の添付後も最後に保存が必要です。";
  };
  submitEdit = async function (event) {
    event.preventDefault();
    if (busy()) return;
    const status = $("formStatus");
    if (!selectedEditRow()) { status.textContent = "追加または編集する内容を選んでください。"; return; }
    if (!window.grade2Backend?.isUnlocked()) {
      status.textContent = "先に上部の編集キーを入力して、編集を有効にしてください。";
      $("editorKey")?.focus();
      return;
    }
    if (window.grade2PhotoEditor?.snapshot()?.file) {
      status.textContent = "選択中の写真はまだDriveに保存されていません。先に「選んだ写真をDriveに保存」を押すか、写真の「選択を解除」を押してください。";
      return;
    }
    const action = mode() === "add" ? "add" : "update";
    rememberDraft();
    const previousKey = currentKey();
    const payload = { ...Object.fromEntries(new FormData(event.currentTarget)), type: selectedEditType };
    if (action === "update") payload.rowNumber = selectedRowNumber;
    const submit = event.currentTarget.querySelector('[type="submit"]');
    saving = true;
    submit.disabled = true;
    $("editFields").disabled = true;
    status.textContent = "保存中…";
    try {
      const result = await window.grade2Backend.request(action, payload);
      const rowNumber = String(result.rowNumber);
      const savedKey = selectedEditType + ":" + rowNumber;
      savedRows.set(savedKey, { ...payload, ...result.row, __rowNumber: rowNumber });
      drafts.delete(previousKey);
      dirty = false;
      renderedKey = "";
      window.grade2Backend.forgetRequests();
      selectedRowNumber = rowNumber;
      clearLocalDataCache();
      let refreshed;
      try { refreshed = await loadData(); }
      catch (error) { console.warn("保存後の再読み込みを完了できませんでした。", error); }
      const synchronized = refreshed?.ok && (appData[selectedEditType] || []).some(row => row.__rowNumber === rowNumber);
      if (synchronized) savedRows.delete(savedKey);
      saving = false;
      renderEditForm(true);
      status.textContent = synchronized ? "保存しました。最新データの表示も確認できました。" : "保存しました。最新一覧の再読み込みは未完了です。保存した内容を表示しています。接続が戻ったら再同期してください。";
      toast("保存しました");
    } catch (error) { status.textContent = `保存できませんでした: ${error.message}`; }
    finally { saving = false; submit.disabled = false; $("editFields").disabled = false; }
  };
  initEvents = function () {
    if (window.location?.href) {
      const params = new URL(window.location.href).searchParams;
      if (Object.prototype.hasOwnProperty.call(EDIT_FIELDS, params.get("type"))) {
        selectedEditType = params.get("type");
        selectedRowNumber = params.get("mode") === "add" ? "__new__" : "";
      }
    }
    $("reloadBtn")?.addEventListener("click", loadData);
    $("copyPrepBtn")?.addEventListener("click", copyPrep);
    $("editTypeSelect")?.addEventListener("change", event => choose(event.target.value, ""));
    $("editSearch")?.addEventListener("input", renderEditRowList);
    $("editForm")?.addEventListener("input", () => { dirty = true; rememberDraft(); });
    $("editForm")?.addEventListener("change", () => { dirty = true; rememberDraft(); });
    $("editForm")?.addEventListener("submit", submitEdit);
    $("resetEditorBtn")?.addEventListener("click", () => { if (busy()) return; drafts.delete(currentKey()); dirty = false; renderEditForm(true); });
    window.addEventListener("grade2:data-updated", () => {
      if (saving) return;
      let updated = false;
      for (const key of savedRows.keys()) {
        const [type, rowNumber] = key.split(":");
        if ((appData[type] || []).some(row => row.__rowNumber === rowNumber)) {
          savedRows.delete(key);
          updated = true;
        }
      }
      if (updated) renderEditForm();
    });
    window.addEventListener("beforeunload", event => {
      rememberDraft();
      if (!saving && !dirty && drafts.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    });
  };
})();
