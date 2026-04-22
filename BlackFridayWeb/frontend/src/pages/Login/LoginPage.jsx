import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import InlineError from "../../components/feedback/InlineError";
import Button from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/FormControls";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { apiClient } from "../../services/api/apiClient";
import { mapErrorToMessage } from "../../utils/errors";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nextRoute = location.state?.from?.pathname || ROUTES.dashboard;

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const fillDemoAdmin = () => {
    setForm({
      email: "admin@example.com",
      password: "password"
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login(form);
      showToast({
        tone: "success",
        title: "Authentication successful",
        description: "The protected operations workspace is now unlocked."
      });
      navigate(nextRoute, { replace: true });
    } catch (submitError) {
      setError(mapErrorToMessage(submitError, "Authentication failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card" style={{ textAlign: "left" }}>
      <div style={{ display: "grid", gap: "0.9rem", textAlign: "center" }}>
        <div
          style={{
            width: "4rem",
            height: "4rem",
            borderRadius: "1.25rem",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg, rgba(97,240,231,0.92), rgba(18,201,193,0.8))",
            color: "#05111c",
            margin: "0 auto"
          }}
        >
          <ShieldCheck size={28} />
        </div>
        <div>
          <h1>Oversell & Lock Access</h1>
          <p style={{ margin: "0.5rem 0 0", color: "var(--color-text-secondary)" }}>
            Authenticate against the real backend before entering the protected
            concurrency workspace.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <Field label="Email">
          <Input
            value={form.email}
            onChange={handleChange("email")}
            placeholder="admin@example.com"
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={form.password}
            onChange={handleChange("password")}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>
        <InlineError message={error} />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing In" : "Sign In to Workspace"}
        </Button>
      </form>

      <div
        style={{
          display: "grid",
          gap: "0.65rem",
          padding: "0.95rem 1rem",
          borderRadius: "1rem",
          border: "1px solid var(--color-border)",
          background: "rgba(17,30,51,0.72)"
        }}
      >
        <strong>Demo admin credentials</strong>
        <div style={{ color: "var(--color-text-secondary)" }}>
          Email: <span className="mono">admin@example.com</span>
        </div>
        <div style={{ color: "var(--color-text-secondary)" }}>
          Password: <span className="mono">password</span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button tone="secondary" onClick={fillDemoAdmin}>
            Use Demo Credentials
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.84rem" }}>
        <div>Backend base URL: {apiClient.getApiBaseUrl()}</div>
        <div>No mock session is used. A real auth response is required to proceed.</div>
      </div>
    </div>
  );
}

export default LoginPage;
