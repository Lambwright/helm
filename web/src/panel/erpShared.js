export const ERP_TYPES = [
  { id: "direct_cost", label: "Direct Costs", one: "Direct Cost" },
  { id: "change_order", label: "Prime Change Orders", one: "Prime Change Order" },
  { id: "prime_contract", label: "Prime Contracts", one: "Prime Contract" },
  { id: "owner_invoice", label: "Owner Invoices", one: "Owner Invoice" },
  { id: "work_order", label: "Subcontracts", one: "Subcontract" },
  { id: "purchase_order", label: "Purchase Orders", one: "Purchase Order" },
  { id: "sub_invoice", label: "Subcontractor Invoices", one: "Subcontractor Invoice" },
];

export const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_\-+.:#/ ]{0,99}$/;

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
