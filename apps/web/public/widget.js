(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var widgetId = script.getAttribute("data-widget-id");
  var publicKey = script.getAttribute("data-public-key");
  var apiUrl =
    script.getAttribute("data-api-url") ||
    new URL(script.src, window.location.href).origin + "/api/v1";

  if (!widgetId || !publicKey) {
    console.warn("[AI Agent Widget] data-widget-id and data-public-key are required.");
    return;
  }

  var storagePrefix = "ai-agent-widget:" + widgetId + ":";
  var state = {
    config: null,
    agent: null,
    open: false,
    loading: false,
    initialized: false,
    visitorId: localStorage.getItem(storagePrefix + "visitorId") || null,
    conversationId: localStorage.getItem(storagePrefix + "conversationId") || null,
    messages: [],
    unread: 0,
    error: null,
  };

  var host = document.createElement("div");
  host.setAttribute("data-ai-agent-widget", widgetId);
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  function request(path, body) {
    return fetch(apiUrl.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ widgetId: widgetId, publicKey: publicKey }, body || {})),
    }).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (payload) {
          if (!response.ok) {
            throw new Error(payload.message || "Widget request failed.");
          }
          return payload;
        });
    });
  }

  function initialize() {
    if (state.initialized) return Promise.resolve();
    state.loading = true;
    render();
    return request("/public/widget/init")
      .then(function (payload) {
        state.config = payload.widget;
        state.agent = payload.agent;
        state.messages = [
          {
            id: "welcome",
            senderType: "ASSISTANT",
            content: payload.widget.welcomeMessage,
            createdAt: new Date().toISOString(),
          },
        ];
        state.initialized = true;
        state.error = null;
      })
      .catch(function (error) {
        state.error = error.message || "Unable to load chat.";
      })
      .finally(function () {
        state.loading = false;
        render();
      });
  }

  function ensureConversation() {
    if (state.conversationId && state.visitorId) {
      return Promise.resolve();
    }
    return request("/public/widget/conversation", {
      visitorId: state.visitorId || undefined,
    }).then(function (payload) {
      state.visitorId = payload.visitorId;
      state.conversationId = payload.conversationId;
      localStorage.setItem(storagePrefix + "visitorId", state.visitorId);
      localStorage.setItem(storagePrefix + "conversationId", state.conversationId);
    });
  }

  function sendMessage(content) {
    if (!content.trim() || state.loading) return;
    var userMessage = {
      id: "local-" + Date.now(),
      senderType: "USER",
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    state.messages.push(userMessage);
    state.loading = true;
    state.error = null;
    render();
    ensureConversation()
      .then(function () {
        return request("/public/widget/chat", {
          visitorId: state.visitorId,
          conversationId: state.conversationId,
          message: content.trim(),
        });
      })
      .then(function (payload) {
        state.messages = state.messages.filter(function (message) {
          return message.id !== userMessage.id;
        });
        state.messages.push(payload.userMessage, payload.assistantMessage);
        if (!state.open) state.unread += 1;
      })
      .catch(function (error) {
        state.error = error.message || "Unable to send message.";
      })
      .finally(function () {
        state.loading = false;
        render();
      });
  }

  function toggleOpen() {
    state.open = !state.open;
    if (state.open) {
      state.unread = 0;
      initialize();
    }
    render();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function markdownLite(value) {
    return escapeHtml(value)
      .replace(/```([\\s\\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/\\*\\*(.*?)\\*\\*/g, "<strong>$1</strong>")
      .replace(/\\n/g, "<br>");
  }

  function render() {
    var color = (state.config && state.config.primaryColor) || "#0f766e";
    var position = (state.config && state.config.position) || "BOTTOM_RIGHT";
    var side = position === "BOTTOM_LEFT" ? "left" : "right";
    var title = (state.config && state.config.name) || "AI Chat";
    var agentName = (state.agent && state.agent.name) || "Assistant";

    root.innerHTML =
      "<style>" +
      ":host{all:initial;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}" +
      ".wrap{position:fixed;bottom:20px;" +
      side +
      ":20px;z-index:2147483000;color:#18181b;}" +
      ".bubble{width:56px;height:56px;border:0;border-radius:18px;background:" +
      color +
      ";color:white;box-shadow:0 18px 40px rgba(0,0,0,.22);cursor:pointer;font:600 22px system-ui;display:flex;align-items:center;justify-content:center;}" +
      ".badge{position:absolute;right:-4px;top:-4px;min-width:18px;height:18px;border-radius:999px;background:#ef4444;color:white;font:700 11px system-ui;display:flex;align-items:center;justify-content:center;padding:0 4px;}" +
      ".panel{width:min(380px,calc(100vw - 28px));height:min(620px,calc(100vh - 104px));margin-bottom:12px;border:1px solid #e4e4e7;border-radius:14px;background:white;box-shadow:0 24px 70px rgba(0,0,0,.22);overflow:hidden;display:flex;flex-direction:column;}" +
      ".head{background:" +
      color +
      ";color:white;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;}" +
      ".head strong{display:block;font-size:15px}.head span{display:block;margin-top:3px;font-size:12px;opacity:.86}.close{border:0;background:rgba(255,255,255,.16);color:white;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;}" +
      ".msgs{flex:1;overflow:auto;background:#fafafa;padding:16px;display:flex;flex-direction:column;gap:10px;}" +
      ".msg{max-width:82%;border:1px solid #e4e4e7;border-radius:12px;padding:10px 12px;font:400 14px/1.45 system-ui;background:white;color:#27272a;}" +
      ".user{align-self:flex-end;background:" +
      color +
      ";border-color:" +
      color +
      ";color:white}.assistant{align-self:flex-start}.time{margin-top:6px;font-size:10px;opacity:.62}.typing{font:400 13px system-ui;color:#71717a}.error{margin:10px 16px 0;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;border-radius:10px;padding:9px 10px;font:400 13px system-ui;}" +
      ".form{border-top:1px solid #e4e4e7;background:white;padding:12px;display:flex;gap:8px}.input{flex:1;min-height:40px;max-height:88px;resize:none;border:1px solid #d4d4d8;border-radius:10px;padding:10px;font:400 14px system-ui;outline:none}.input:focus{border-color:" +
      color +
      "}.send{border:0;border-radius:10px;background:" +
      color +
      ";color:white;padding:0 14px;font:700 13px system-ui;cursor:pointer}.send:disabled{opacity:.55;cursor:not-allowed}" +
      "pre{white-space:pre-wrap;overflow:auto;border-radius:8px;background:#18181b;color:#fafafa;padding:8px;font-size:12px}" +
      "@media (max-width:480px){.wrap{left:12px;right:12px;bottom:12px}.panel{width:100%;height:calc(100vh - 92px)}.bubble{margin-left:auto}}" +
      "</style>" +
      "<div class='wrap'>" +
      (state.open
        ? "<section class='panel' aria-live='polite'><header class='head'><div><strong>" +
          escapeHtml(title) +
          "</strong><span>" +
          escapeHtml(agentName) +
          "</span></div><button class='close' type='button' data-close>×</button></header>" +
          (state.error ? "<div class='error'>" + escapeHtml(state.error) + "</div>" : "") +
          "<div class='msgs' data-messages>" +
          state.messages
            .map(function (message) {
              return (
                "<article class='msg " +
                (message.senderType === "USER" ? "user" : "assistant") +
                "'><div>" +
                markdownLite(message.content) +
                "</div><div class='time'>" +
                new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }) +
                "</div></article>"
              );
            })
            .join("") +
          (state.loading ? "<div class='typing'>Assistant is typing...</div>" : "") +
          "</div><form class='form' data-form><textarea class='input' data-input rows='1' placeholder='Type your message...'></textarea><button class='send' type='submit'" +
          (state.loading ? " disabled" : "") +
          ">Send</button></form></section>"
        : "") +
      "<button class='bubble' type='button' data-toggle aria-label='Open chat'>💬" +
      (state.unread ? "<span class='badge'>" + state.unread + "</span>" : "") +
      "</button></div>";

    var toggle = root.querySelector("[data-toggle]");
    if (toggle) toggle.addEventListener("click", toggleOpen);
    var close = root.querySelector("[data-close]");
    if (close) close.addEventListener("click", toggleOpen);
    var form = root.querySelector("[data-form]");
    var input = root.querySelector("[data-input]");
    if (form && input) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        sendMessage(input.value);
      });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendMessage(input.value);
        }
      });
      input.focus();
    }
    var messages = root.querySelector("[data-messages]");
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  render();
})();
