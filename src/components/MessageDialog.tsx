import { createPortal } from "react-dom";

export function MessageDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return createPortal(<div className="modal-backdrop message-backdrop" onClick={onClose}>
    <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="message-heading" aria-describedby="message-body" onClick={(event) => event.stopPropagation()}>
      <h2 id="message-heading">Unable to complete action</h2>
      <p id="message-body">{message}</p>
      <div className="modal-actions"><button autoFocus className="button primary" onClick={onClose}>Dismiss</button></div>
    </div>
  </div>, document.body);
}
