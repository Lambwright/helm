import Modal from "./Modal.jsx";

// No email-sending infrastructure exists in the suite yet (see auth-worker's
// README) — this is a placeholder until a real reset-by-email flow is built.
// Deliberately loud: this is the one thing a locked-out user actually needs
// to know, so it doesn't get to hide as fine print under the login form.
export default function ForgotPasswordModal({ onClose }) {
  return (
    <Modal title="Forgot your password?" onClose={onClose}>
      <div
        style={{
          background: "rgba(209,169,63,0.1)",
          border: "1px solid var(--yellow)",
          borderRadius: "var(--radius-md)",
          padding: "20px",
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--yellow)", marginBottom: 8 }}>
          Self-service reset isn't set up yet
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
          Contact your HELM administrator directly and ask them to reset it for you
          from the Users tab.
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-accent btn-sm" onClick={onClose}>Got it</button>
      </div>
    </Modal>
  );
}
