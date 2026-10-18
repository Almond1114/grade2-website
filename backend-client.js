// 編集キーはこのページのメモリだけに保持し、URLやlocalStorageへ保存しません。
(function () {
  let editorKey = "";
  let status = null;
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
    let response;
    try {
      response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(body), credentials: "omit", redirect: "follow", cache: "no-store", signal: controller.signal });
    } catch (error) {
      throw new Error(error.name === "AbortError" ? "応答がありません。保存済みの可能性があるため、一覧やDriveを確認してから再送してください。" : "通信できません。接続先とApps Scriptの再デプロイを確認してください。保存済みの場合もあるので一覧やDriveを確認してください。");
    } finally { clearTimeout(timer); }
    let result;
    try { result = await response.json(); }
    catch (_) { throw new Error("Apps Scriptが旧版か、Googleの権限承認が未完了です。Code.gs・Media.gsを更新して再デプロイしてください。"); }
    if (!response.ok || !result?.ok) throw new Error(result?.error || "保存できませんでした。");
    return result;
  }
  function forgetRequests() { requestIds.clear(); }
  window.grade2Backend = { request, forgetRequests, isUnlocked: () => !!status, getStatus: () => status };
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("unlockEditor");
    const input = document.getElementById("editorKey");
    const message = document.getElementById("editorAccessStatus");
    async function unlock() {
      if (button.disabled) return;
      button.disabled = true;
      editorKey = input.value.trim();
      message.textContent = "接続を確認しています…";
      try {
        status = await request("mediaStatus");
        input.value = "";
        message.textContent = "編集が有効になりました。このページを閉じるとキーは消去されます。";
        button.textContent = "編集キーを確認済み";
        window.dispatchEvent(new CustomEvent("grade2:editor-unlocked"));
      } catch (error) {
        editorKey = "";
        status = null;
        message.textContent = error.message;
        button.textContent = "編集を有効にする";
      } finally { button.disabled = false; }
    }
    button?.addEventListener("click", unlock);
    input?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); unlock(); } });
  });
})();
