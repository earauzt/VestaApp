import { Navigate } from "react-router-dom";
import { HOUSEHOLD_DASHBOARD_PATH } from "../utils/householdSession";

/** No login form. Bookmarks to /login go to the household dashboard. */
export default function Login() {
  return <Navigate to={HOUSEHOLD_DASHBOARD_PATH} replace />;
}
