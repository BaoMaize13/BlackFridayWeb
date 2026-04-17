import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";

function NotFoundPage() {
  return (
    <div className="fullscreen-shell">
      <div className="auth-card">
        <h1>Route Not Found</h1>
        <p>The requested page is not part of the refactored frontend workspace.</p>
        <Link to={ROUTES.dashboard}>
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
