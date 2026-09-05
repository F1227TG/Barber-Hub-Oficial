/** Rascunhos privados da aba. Um envio incerto conserva chave E conteúdo. */
(function operationDraft(global) {
  "use strict";
  const PREFIX = "barber-hub:operation-draft:v1:";
  const TTL = 2 * 60 * 60 * 1000;
  const storage = () => global.sessionStorage;
  const address = (scope, kind) => PREFIX + encodeURIComponent(scope) + ":" + kind;
  function load(scope, kind) {
    try {
      const item = JSON.parse(storage().getItem(address(scope, kind)) || "null");
      if (!item || item.scope !== scope || item.kind !== kind) return null;
      // Não expirar silenciosamente uma operação cujo resultado ainda é incerto.
      if (!item.payload && Date.now() - item.updatedAt > TTL) { clear(scope, kind); return null; }
      return item;
    } catch (_) { return null; }
  }
  function write(scope, kind, item) {
    try { storage().setItem(address(scope, kind), JSON.stringify(item)); }
    catch (_) { throw new Error("Permita o armazenamento desta aba para proteger o reenvio. Seus campos continuam preenchidos."); }
    return item;
  }
  function save(scope, kind, fields) {
    const previous = load(scope, kind);
    if (previous?.payload) return previous;
    return write(scope, kind, { scope, kind, fields, updatedAt:Date.now(),
      key:previous?.key || `${kind}.${global.crypto.randomUUID()}` });
  }
  function begin(scope, kind, fields, payload) {
    const item = load(scope, kind) || save(scope, kind, fields);
    if (item.payload) return item.payload;
    item.fields = fields;
    item.payload = { ...payload, chave_idempotencia:item.key };
    write(scope, kind, item); // Persistir ANTES da chamada de rede.
    return item.payload;
  }
  // Erros conclusivos (por exemplo, validação 422) permitem corrigir os
  // campos, mas conservam a mesma chave para um novo envio daquele rascunho.
  function release(scope, kind) {
    const item = load(scope, kind);
    if (!item) return null;
    delete item.payload;
    item.updatedAt = Date.now();
    return write(scope, kind, item);
  }
  function clear(scope, kind) { storage().removeItem(address(scope, kind)); }
  function clearAll() {
    try { Object.keys(storage()).filter(key => key.startsWith(PREFIX)).forEach(key => storage().removeItem(key)); } catch (_) {}
  }
  global.bhOperationDraft = { load, save, begin, release, clear, clearAll };
})(window);
