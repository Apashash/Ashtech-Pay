(function (window, document) {
  "use strict";

  var activeCheckout = null;
  var previousBodyOverflow = "";

  function resolveCheckoutUrl(options) {
    var rawUrl = options.paymentLink || options.checkoutUrl || options.url;
    if (!rawUrl && options.slug) {
      rawUrl = "/pay/" + encodeURIComponent(String(options.slug));
    }
    if (!rawUrl) {
      throw new Error("AshTechPayCheckout.open() requires paymentLink, checkoutUrl, url or slug.");
    }

    var url = new URL(rawUrl, window.location.origin);
    url.searchParams.set("embed", "1");
    return url.toString();
  }

  function closeCheckout(reason) {
    if (!activeCheckout) return;

    var checkout = activeCheckout;
    activeCheckout = null;
    window.removeEventListener("message", checkout.onMessage);
    document.removeEventListener("keydown", checkout.onKeyDown);
    if (checkout.overlay.parentNode) checkout.overlay.parentNode.removeChild(checkout.overlay);
    document.body.style.overflow = previousBodyOverflow;

    if (reason === "cancel" && typeof checkout.options.onCancel === "function") {
      checkout.options.onCancel();
    }
    if (typeof checkout.options.onClose === "function") {
      checkout.options.onClose(reason || "close");
    }
  }

  function openCheckout(options) {
    options = options || {};
    closeCheckout("replace");

    var checkoutUrl = resolveCheckoutUrl(options);
    var overlay = document.createElement("div");
    var panel = document.createElement("div");
    var closeButton = document.createElement("button");
    var iframe = document.createElement("iframe");

    overlay.setAttribute("data-ashtechpay-checkout", "true");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", options.title || "AshTechPay checkout");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:clamp(8px,3vw,28px)",
      "background:rgba(15,23,42,.72)",
      "backdrop-filter:blur(4px)",
      "-webkit-backdrop-filter:blur(4px)",
    ].join(";");

    panel.style.cssText = [
      "position:relative",
      "width:min(100%,520px)",
      "height:min(100%,860px)",
      "min-height:560px",
      "overflow:hidden",
      "background:#fff",
      "border-radius:18px",
      "box-shadow:0 24px 80px rgba(0,0,0,.35)",
    ].join(";");

    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close checkout");
    closeButton.textContent = "×";
    closeButton.style.cssText = [
      "position:absolute",
      "top:10px",
      "right:12px",
      "z-index:2",
      "width:36px",
      "height:36px",
      "border:0",
      "border-radius:999px",
      "background:rgba(15,23,42,.08)",
      "color:#0f172a",
      "font:32px/30px Arial,sans-serif",
      "cursor:pointer",
    ].join(";");

    iframe.title = options.title || "AshTechPay secure checkout";
    iframe.src = checkoutUrl;
    iframe.allow = "payment";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.style.cssText = [
      "display:block",
      "width:100%",
      "height:100%",
      "border:0",
      "background:#fff",
    ].join(";");

    panel.appendChild(closeButton);
    panel.appendChild(iframe);
    overlay.appendChild(panel);

    var checkout = {
      options: options,
      overlay: overlay,
      iframe: iframe,
      onMessage: null,
      onKeyDown: null,
    };

    checkout.onMessage = function (event) {
      if (event.source !== iframe.contentWindow) return;
      var data = event.data || {};
      if (data.source !== "ashtechpay-checkout") return;

      if (data.event === "success" && typeof options.onSuccess === "function") {
        options.onSuccess(data);
      }
      if (data.event === "failure" && typeof options.onFailure === "function") {
        options.onFailure(data);
      }
      if (data.event === "cancel" && typeof options.onCancel === "function") {
        options.onCancel(data);
      }

      if (
        (data.event === "success" && options.closeOnSuccess !== false) ||
        (data.event === "cancel" && options.closeOnCancel !== false)
      ) {
        closeCheckout(data.event);
      }
    };
    checkout.onKeyDown = function (event) {
      if (event.key === "Escape" && options.closeOnEscape !== false) {
        closeCheckout("cancel");
      }
    };

    closeButton.addEventListener("click", function () {
      closeCheckout("cancel");
    });
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay && options.closeOnBackdrop !== false) {
        closeCheckout("cancel");
      }
    });
    window.addEventListener("message", checkout.onMessage);
    document.addEventListener("keydown", checkout.onKeyDown);

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    activeCheckout = checkout;

    if (typeof options.onOpen === "function") options.onOpen(checkout);
    return {
      close: function () {
        closeCheckout("api");
      },
      isOpen: function () {
        return activeCheckout === checkout;
      },
    };
  }

  window.AshTechPayCheckout = {
    open: openCheckout,
    close: function () {
      closeCheckout("api");
    },
    isOpen: function () {
      return !!activeCheckout;
    },
  };
})(window, document);