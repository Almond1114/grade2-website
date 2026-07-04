// 2Base editor add/update UI layer
// app-core.js の編集画面だけを上書きして、上段を「追加」、下段を「既存行編集」に分けます。
(function () {
  if (window.__grade2EditorAddLayer) return;
  window.__grade2EditorAddLayer = true;

  function currentMode() {
    return selectedRowNumber === "__new__" ? "add" : "update";
  }

  function setHiddenMode(mode) {
    const input = $("editMode");
    if (input) input.value = mode;
  }

  function blankRow(type) {
    const row = { __rowNumber: "" };
    (EDIT_FIELDS[type] || []).forEach(([name]) => { row[name] = ""; });

    if (Object.prototype.hasOwnProperty.call(row, "表示")) row.表示 = "TRUE";
    if (Object.prototype.hasOwnProperty.call(row, "クラス")) row.クラス = selectedClass || "全体";

    const today = dateKey(new Date());
    if (type === "announcements") {
      row.日付 = today;
      row.カテゴリ = "連絡";
      row.クラス = "全体";
    }
    if (type === "timetable") {
      row.クラス = selectedClass || "2-3";
      row.曜日 = "月";
    }
    if (type === "tests") {
      row.日付 = today;
      row.クラス = "全体";
    }
    if (type === "homework") {
      row.締切 = today;
      row.クラス = "全体";
    }
    if (type === "items") {
      row.クラス = "全体";
    }
    if (type === "links") {
      row.カテゴリ = "学習";
    }
    return row;
  }

  function setAddMode(type) {
    selectedEditType = type || selectedEditType;
    selectedRowNumber = "__new__";
    setHiddenMode("add");
    renderEditor();
    $("editForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setUpdateMode(type, rowNumber) {
    selectedEditType = type || selectedEditType;
    selectedRowNumber = rowNumber || "";
    setHiddenMode("update");
    renderEditor();
  }

  selectedEditRow = function () {
    if (currentMode() === "add") return blankRow(selectedEditType);
    return (appData[selectedEditType] || []).find(r => r.__rowNumber === selectedRowNumber) || null;
  };

  renderEditor = function () {
    if (!document.body.matches('[data-page="edit"]')) return;
    renderEditTypeCards();
    renderEditTypeSelect();
    renderEditRowList();
    renderEditForm();
    renderEditLog();
  };

  renderEditTypeCards = function () {
    const box = $("editTypeCards");
    if (!box) return;
    box.innerHTML = EDIT_TYPE_ORDER.map(type => {
      const meta = EDIT_TYPE_META[type] || { icon: "✏️", short: "追加", hint: "新しい内容を追加" };
      const active = currentMode() === "add" && type === selectedEditType;
      return `<button class="edit-type-card editor-menu-card ${active ? "active" : ""}" data-add-type="${type}" type="button">
        <span class="edit-type-icon">${meta.icon}</span>
        <span class="edit-type-copy"><strong>${escapeHtml(TYPE_LABELS[type])}を追加</strong><span>${escapeHtml(meta.short)}</span><small>新しい行としてスプレッドシートに追加</small></span>
        <em>追加</em>
      </button>`;
    }).join("");
    box.querySelectorAll("[data-add-type]").forEach(btn => {
      btn.onclick = () => setAddMode(btn.dataset.addType);
    });
  };

  function renderEditTypeSelect() {
    const select = $("editTypeSelect");
    if (!select) return;
    select.innerHTML = EDIT_TYPE_ORDER.map(type => `<option value="${type}" ${type === selectedEditType ? "selected" : ""}>${escapeHtml(TYPE_LABELS[type])}</option>`).join("");
    select.onchange = () => setUpdateMode(select.value, "");
  }

  renderEditRowList = function () {
    const list = $("editRowList");
    if (!list) return;
    const rows = rowsForEdit();
    if (!rows.length) {
      list.innerHTML = emptyState(`${TYPE_LABELS[selectedEditType] || "この種類"}の行が見つかりません。検索条件を変えてください。`);
      return;
    }
    list.innerHTML = rows.map(row => {
      const sub = selectedEditType === "timetable"
        ? `${row["1時間目"] || ""} ${row["2時間目"] || ""} ${row["3時間目"] || ""}`
        : (row.本文 || row.内容 || row.範囲 || row.持ち物 || row.説明 || row.メモ || "");
      const cls = row.クラス ? ` / ${row.クラス}` : "";
      const active = currentMode() === "update" && row.__rowNumber === selectedRowNumber;
      return `<button type="button" class="edit-row ${active ? "active" : ""}" data-row="${escapeHtml(row.__rowNumber)}">
        <span>${escapeHtml(rowTitle(selectedEditType, row))}</span>
        <small>${escapeHtml(TYPE_LABELS[selectedEditType])}${escapeHtml(cls)} / シート ${escapeHtml(row.__rowNumber)} 行目</small>
        ${sub ? `<p>${escapeHtml(sub).slice(0, 90)}</p>` : ""}
      </button>`;
    }).join("");
    list.querySelectorAll("[data-row]").forEach(btn => {
      btn.onclick = () => setUpdateMode(selectedEditType, btn.dataset.row);
    });
  };

  function buildFields(row) {
    return EDIT_FIELDS[selectedEditType].map(([name, type, choices]) => {
      const value = row[name] || "";
      const help = fieldHelpText(name, selectedEditType);
      if (type === "select") {
        return `<label><span>${escapeHtml(name)}</span><select name="${escapeHtml(name)}">${choices.map(c => `<option value="${escapeHtml(c)}" ${c === value ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select>${help}</label>`;
      }
      if (type === "textarea") {
        return `<label class="wide"><span>${escapeHtml(name)}</span><textarea name="${escapeHtml(name)}" rows="4">${escapeHtml(value)}</textarea>${help}</label>`;
      }
      return `<label><span>${escapeHtml(name)}</span><input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}">${help}</label>`;
    }).join("");
  }

  renderEditForm = function () {
    const form = $("editForm");
    const fieldsBox = $("editFields");
    const title = $("editFormTitle");
    if (!form || !fieldsBox) return;

    const mode = currentMode();
    setHiddenMode(mode);
    const meta = EDIT_TYPE_META[selectedEditType] || {};

    if (mode === "add") {
      const row = blankRow(selectedEditType);
      if (title) title.textContent = `新しく追加：${TYPE_LABELS[selectedEditType]}`;
      const preview = `<div class="edit-current-preview wide add-preview"><span>${meta.icon || "＋"} 新規追加</span><strong>${escapeHtml(TYPE_LABELS[selectedEditType])}を追加</strong><small>保存するとスプレッドシートに新しい行が増えます。</small></div>`;
      fieldsBox.innerHTML = preview + buildFields(row);
      const status = $("formStatus");
      if (status) status.textContent = "入力して保存すると、新しい行として追加されます。";
      return;
    }

    const row = (appData[selectedEditType] || []).find(r => r.__rowNumber === selectedRowNumber) || null;
    if (!row) {
      if (title) title.textContent = "編集する行を選んでください";
      fieldsBox.innerHTML = emptyState("左の一覧から、サイトに載っている内容を選んでください。上のカードは新規追加用です。 ");
      const status = $("formStatus");
      if (status) status.textContent = "既存の内容を編集する場合は、左の一覧から選びます。";
      return;
    }

    if (title) title.textContent = rowTitle(selectedEditType, row);
    const preview = `<div class="edit-current-preview wide"><span>${meta.icon || "✏️"} ${escapeHtml(TYPE_LABELS[selectedEditType])}を編集中</span><strong>${escapeHtml(rowTitle(selectedEditType, row))}</strong><small>保存先：スプレッドシート ${escapeHtml(row.__rowNumber)} 行目</small></div>`;
    fieldsBox.innerHTML = preview + buildFields(row);
  };

  submitEdit = async function (event) {
    event.preventDefault();
    const status = $("formStatus");
    if (!GAS_URL) {
      if (status) status.textContent = "GAS_URLが未設定なので保存できません。";
      return;
    }

    const mode = currentMode();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams({ action: mode === "add" ? "add" : "update", type: selectedEditType });

    if (mode === "update") {
      const row = selectedEditRow();
      if (!row) {
        if (status) status.textContent = "編集する行を選んでください。";
        return;
      }
      params.set("rowNumber", row.__rowNumber);
    }

    for (const [key, value] of formData.entries()) params.set(key, value);
    if (status) status.textContent = mode === "add" ? "追加中..." : "保存中...";

    try {
      const res = await jsonp(`${GAS_URL}?${params.toString()}&_=${Date.now()}`);
      if (!res?.ok) throw new Error(res?.error || (mode === "add" ? "追加エラー" : "保存エラー"));
      if (status) status.textContent = `${mode === "add" ? "追加" : "保存"}しました。${res.push ? `通知: 成功${res.push.sent || 0} 失敗${res.push.failed || 0}` : ""}`;
      clearLocalDataCache();
      selectedRowNumber = res.rowNumber ? String(res.rowNumber) : "";
      await loadData();
      setHiddenMode("update");
    } catch (error) {
      if (status) status.textContent = `${mode === "add" ? "追加" : "保存"}できませんでした: ${error.message}`;
    }
  };

  initEvents = function () {
    $("reloadBtn")?.addEventListener("click", loadData);
    $("copyPrepBtn")?.addEventListener("click", copyPrep);
    $("editSearch")?.addEventListener("input", () => {
      if (currentMode() !== "add") selectedRowNumber = "";
      renderEditRowList();
      renderEditForm();
    });
    $("editTypeSelect")?.addEventListener("change", (event) => setUpdateMode(event.currentTarget.value, ""));
    $("editForm")?.addEventListener("submit", submitEdit);
    $("resetEditorBtn")?.addEventListener("click", () => renderEditForm());
  };
})();
