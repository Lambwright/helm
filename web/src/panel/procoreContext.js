// Procore's side panel handshake, same as LEDGER's frontend/src/procore.js. Procore
// doesn't put the record in the iframe URL: the panel posts {type:'initialize'} to the
// parent and Procore answers with {type:'setup', context:{company_id, project_id, id, view}}.
//
// LEDGER found that answer is a one-time reply when the panel attaches, so it can go
// stale when someone moves to another page. That's why the panel re-reads the record,
// shows it, and asks for a confirm before uploading, and why it has a Refresh button.

export function isEmbedded() {
  try {
    return window.parent && window.parent !== window;
  } catch {
    return true; // cross-origin parent access threw, so we're framed
  }
}

function isProcoreOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    if (host === "procore.com" || host.endsWith(".procore.com")) return true;
    return import.meta.env.DEV && host === "localhost";
  } catch {
    return false;
  }
}

export function connectProcorePanel({ onContext, onVisible }) {
  function handleMessage(event) {
    if (!isProcoreOrigin(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    // Left in on purpose, as in LEDGER: the first real embed shows Procore's real view names.
    console.info("[HELM panel] Procore message:", event.origin, JSON.stringify(data));
    if (data.type === "setup" && data.context) {
      const c = data.context;
      onContext({
        projectId: c.project_id != null ? String(c.project_id) : null,
        recordId: c.id != null ? String(c.id) : null,
        view: c.view ?? null,
      });
    } else if (data.type === "sidepanel:app:visible") {
      onVisible?.();
    }
  }
  window.addEventListener("message", handleMessage);

  // The payload isn't sensitive, and every reply is origin-checked above. Retried in
  // case Procore's listener isn't ready on our first frame.
  let tries = 0;
  let timer;
  function ping() {
    try {
      window.parent.postMessage({ type: "initialize" }, "*");
    } catch {
      /* ignore */
    }
    if (++tries < 6) timer = setTimeout(ping, 400);
  }
  if (isEmbedded()) ping();

  return () => {
    clearTimeout(timer);
    window.removeEventListener("message", handleMessage);
  };
}

// True for any Direct Costs page, whatever exact name Procore gives it.
export function isDirectCostView(view) {
  return /direct[\s_-]?cost/i.test(String(view || ""));
}

// Which list the ERP tab opens on. Only a starting point: Procore's real view names
// aren't known yet and the person can always pick another type. Most specific first,
// because a Prime Contract page can hold invoices and change orders too.
export function erpTypeForView(view) {
  const v = String(view || "").toLowerCase().replace(/[\s_-]/g, "");
  if (v.includes("directcost")) return "direct_cost";
  if (v.includes("changeorder")) return "change_order";
  if (v.includes("requisition") || v.includes("subcontractorinvoice")) return "sub_invoice";
  if (v.includes("paymentapplication") || v.includes("ownerinvoice")) return "owner_invoice";
  if (v.includes("purchaseorder")) return "purchase_order";
  if (v.includes("workorder") || v.includes("commitment") || v.includes("subcontract")) return "work_order";
  if (v.includes("primecontract")) return "prime_contract";
  return "direct_cost";
}
