import Button from "../ui/Button";
import Modal from "../ui/Modal";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  onCancel,
  onConfirm
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      actions={
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <Button tone="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button tone={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>{description}</p>
    </Modal>
  );
}

export default ConfirmDialog;
