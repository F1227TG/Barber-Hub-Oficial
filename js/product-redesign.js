/**
 * product-redesign.js
 * --------------------------------------------------------------------------
 * Interações compartilhadas do redesign 1.5:
 * - chamada principal para instalar o PWA;
 * - instruções de instalação quando o navegador não oferece prompt nativo;
 * - pequenos ajustes de densidade e acessibilidade em telas móveis.
 * --------------------------------------------------------------------------
 */

(() => {
  "use strict";

  let installPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function installButtons() {
    return [...document.querySelectorAll("[data-install-app]")];
  }

  function updateInstallButtons() {
    const installed = isStandalone();
    installButtons().forEach(button => {
      button.classList.toggle("is-installed", installed);
      button.hidden = installed;
      button.toggleAttribute("hidden", installed);
      button.setAttribute("aria-disabled", installed ? "true" : "false");
      const label = button.querySelector("[data-install-label]");
      const helper = button.querySelector("[data-install-helper]");
      if (label) label.textContent = installed ? "Barber Hub instalado" : "Instalar Barber Hub no celular";
      if (helper) helper.textContent = installed
        ? "Você já está usando a experiência de aplicativo."
        : "Acesso rápido, tela cheia e atalho na tela inicial.";
    });
  }

  async function showInstallInstructions(trigger) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const text = ios
      ? "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”."
      : "Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.";

    if (typeof window.bhConfirmar === "function") {
      await window.bhConfirmar({
        titulo: "Instalar Barber Hub",
        mensagem: text,
        confirmarTexto: "Entendi",
        cancelarTexto: "Fechar",
        trigger
      });
      return;
    }
    window.mostrarToast?.("info", "Instalar Barber Hub", text);
  }

  async function installApp(trigger) {
    if (isStandalone()) {
      window.mostrarToast?.("info", "Aplicativo instalado", "O Barber Hub já está aberto no modo aplicativo.");
      return;
    }
    if (!installPrompt) {
      await showInstallInstructions(trigger);
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    updateInstallButtons();
  }

  function configureInstall() {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      installPrompt = event;
      document.body.classList.add("pwa-install-available");
      updateInstallButtons();
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      document.body.classList.add("pwa-installed");
      updateInstallButtons();
      window.mostrarToast?.("sucesso", "Barber Hub instalado", "O atalho foi adicionado ao seu dispositivo.");
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-install-app]");
      if (!button) return;
      event.preventDefault();
      installApp(button);
    });

    updateInstallButtons();
  }

  function labelDynamicTables(root = document) {
    const tables = new Set();
    if (root?.matches?.("table")) tables.add(root);
    root?.querySelectorAll?.("table").forEach(table => tables.add(table));
    const parentTable = root?.closest?.("table");
    if (parentTable) tables.add(parentTable);
    tables.forEach(table => {
      const labels = [...table.querySelectorAll("thead th")].map(item => item.textContent.trim());
      table.querySelectorAll("tbody tr").forEach(row => [...row.children].forEach((cell,index) => { if (labels[index] && !cell.dataset.label) cell.dataset.label = labels[index]; }));
    });
  }

  function observeDynamicContent() {
    const observer = new MutationObserver(records => {
      let installControlAdded = false;
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        labelDynamicTables(node);
        if (node.matches?.("[data-install-app]") || node.querySelector?.("[data-install-app]")) installControlAdded = true;
      }
      if (installControlAdded) updateInstallButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    configureInstall();
    labelDynamicTables();
    observeDynamicContent();
  });
})();
