// 編集キーはこのページのメモリだけに保持し、URLやlocalStorageへ保存しません。
(function () {
  let editorKey = "";
  let status = null;
  let sessionGeneration = 0;
  const requestIds = new Map();
  async function request(action, payload = {}) {
    if (!editorKey) throw new Error("先に編集キーを入力して、編集を有効にしてください。");
    const endpoint = String(window.GRADE2_CONFIG?.GAS_URL || "").trim();
    if (!endpoint) throw new Error("Apps Scriptの接続先が未設定です。");
    const body = { ...payload, action, editorKey };
    if (["add", "update", "uploadPhoto"].includes(action)) {
      const signature = JSON.stringify({ ...payload, action });
      if (!requestIds.has(signature)) requestIds.set(signature, crypto.randomUUID().replace(/-/g, ""));
      body.requestId = requestIds.get(signature);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(body), credentials: "omit", redirect: "follow", cache: "no-store", signal: controller.signal });
      let result;
      try { result = await response.json(); }
      catch (error) {
        if (controller.signal.aborted || error.name === "AbortError") throw error;
        throw new Error("Apps Scriptが旧版か、Googleの権限承認が未完了です。Code.gs・Media.gsを更新して再デプロイしてください。");
      }
      if (!response.ok || !result?.ok) throw new Error(result?.error || "保存できませんでした。");
      return result;
    } catch (error) {
      if (controller.signal.aborted || error.name === "AbortError") throw new Error("応答がありません。保存済みの可能性があるため、一覧やDriveを確認してから再送してください。");
      if (error.name === "TypeError") throw new Error("通信できません。接続先とApps Scriptの再デプロイを確認してください。保存済みの場合もあるので一覧やDriveを確認してください。");
      throw error;
    } finally { clearTimeout(timer); }
  }
  function forgetRequests() { requestIds.clear(); }
  function lockEditor() {
    sessionGeneration++;
    editorKey = "";
    status = null;
    const input = document.getElementById("editorKey");
    const button = document.getElementById("unlockEditor");
    const message = document.getElementById("editorAccessStatus");
    if (input) { input.value = ""; input.disabled = false; }
    if (button) { button.textContent = "編集を有効にする"; button.disabled = false; }
    if (message) message.textContent = "編集を終了しました。再開するときは編集キーを入力してください。";
    window.dispatchEvent(new CustomEvent("grade2:editor-locked"));
  }
  window.grade2Backend = { request, forgetRequests, lock: lockEditor, isUnlocked: () => !!status && !!editorKey, getStatus: () => status };
  window.addEventListener("pagehide", () => lockEditor());
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("unlockEditor");
    const input = document.getElementById("editorKey");
    const message = document.getElementById("editorAccessStatus");
    async function unlock() {
      if (button.disabled) return;
      if (status) { lockEditor(); return; }
      button.disabled = true;
      const generation = sessionGeneration;
      editorKey = input.value.trim();
      message.textContent = "接続を確認しています…";
      try {
        const verified = await request("mediaStatus");
        if (generation !== sessionGeneration) return;
        if (Number(verified.apiVersion) < 4 || !Number.isFinite(Number(verified.apiVersion)) || verified.classId !== "2-3") throw new Error("接続先が2年3組版ではありません。Apps Scriptを新バージョンで再デプロイしてください。");
        status = verified;
        input.value = "";
        input.disabled = true;
        message.textContent = "編集が有効になりました。このページを閉じるとキーは消去されます。";
        button.textContent = "編集を終了する";
        window.dispatchEvent(new CustomEvent("grade2:editor-unlocked"));
      } catch (error) {
        if (generation !== sessionGeneration) return;
        editorKey = "";
        status = null;
        input.disabled = false;
        message.textContent = error.message;
        button.textContent = "編集を有効にする";
      } finally { if (generation === sessionGeneration) button.disabled = false; }
    }
    button?.addEventListener("click", unlock);
    input?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); unlock(); } });
  });
})();
