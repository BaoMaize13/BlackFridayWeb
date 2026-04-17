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
  const [form, setForm] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nextRoute = location.state?.from?.pathname || ROUTES.dashboard;

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
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
        <Field label="Username or Email">
          <Input
            value={form.username}
            onChange={handleChange("username")}
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

      <div style={{ display: "grid", gap: "0.5rem", color: "var(--color-text-muted)", fontSize: "0.84rem" }}>
        <div>Backend base URL: {apiClient.getApiBaseUrl()}</div>
        <div>No mock session is used. A real auth response is required to proceed.</div>
      </div>
    </div>
  );
}

export default LoginPage;
