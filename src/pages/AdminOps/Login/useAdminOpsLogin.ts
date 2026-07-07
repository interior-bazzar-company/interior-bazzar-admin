// ── useAdminOpsLogin ── staff sign-in for the v3 admin ops console.
// Ported from prototype/admin-login.html but wired to the REAL backend
// (AuthService.signin → TokenService → redux). Field accepts the account
// username (not the strict Validator.validateUsername — the backend decides).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthService } from "../../../api/modules/auth";
import { TokenService } from "../../../api/apiService/authHelper/TokenService";
import { setAuth } from "../../../redux/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../../../redux/store/hook";
import { AUTH_VARS, PAGES } from "../../../utils/constants/app";

const useAdminOpsLogin = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already signed in → straight to the console.
  useEffect(() => {
    if (isAuthenticated) navigate(PAGES.ADMIN_OPS_ROOT, { replace: true });
  }, [isAuthenticated, navigate]);

  const fail = (msg: string) => {
    setError(msg);
    setShake(false);
    // re-trigger the shake animation on the next frame
    requestAnimationFrame(() => setShake(true));
  };

  const clearError = () => {
    if (error) setError("");
  };

  const signIn = async () => {
    const username = email.trim();
    if (!username || !password) {
      fail("Enter your username and password.");
      return;
    }
    try {
      setLoading(true);
      const res = await AuthService.signin({ username, password });
      if (!res.response) {
        fail(res.message || "Incorrect username or password.");
        return;
      }
      const access = res.data?.[AUTH_VARS.ACCESS];
      const refresh = res.data?.[AUTH_VARS.REFRESH];
      if (typeof access !== "string" || typeof refresh !== "string") {
        fail("Sign-in failed — no session token returned.");
        return;
      }
      TokenService.setTokens(access, refresh);
      dispatch(setAuth({ isAuthenticated: true }));
      navigate(PAGES.ADMIN_OPS_ROOT, { replace: true });
    } catch {
      fail("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return { email, setEmail, password, setPassword, error, shake, loading, signIn, clearError };
};

export default useAdminOpsLogin;
