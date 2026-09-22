import { useState } from "react";
import Modal from "./Modal.jsx";

export default function ConfirmModal({ title, body, confirmLabel, danger, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">{body}</div>
      {error && <div className="login-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
        <button
          type="button"
          className={`btn btn-sm ${danger ? "btn-danger" : "btn-accent"}`}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
