import { useEffect } from "react";

export default function Toast({ message, error, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div className={`toast${error ? " error" : ""}`} onClick={onDismiss}>
      {message}
    </div>
  );
}
