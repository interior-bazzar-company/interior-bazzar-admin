import { useEffect, useState } from "react";
import useLogout from "./useLogout";
import { logger } from "../../utils/logger";
import type { BaseUser } from "../../types/global";
import { UserService } from "../../api/modules/user";
import { setAuth } from "../../redux/slice/authSlice";
import { setUser } from "../../redux/slice/userSlice";
import type { ApiResponseType } from "../../types/reqResType";
import { useAppDispatch, useAppSelector } from "../../redux/store/hook";
import { TokenService } from "../../api/apiService/authHelper/TokenService";
const useInitUser = () => {
  const [loading, setLoading] = useState(true);
  const { logout } = useLogout();
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);
  const { isAuthenticated } = auth;

  const fetchUser = async () => {
    if (isAuthenticated) {
      setLoading(false);
      return;
    }
    const access = TokenService.getAccessToken();
    if (!access) {
      logout();
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res: ApiResponseType<BaseUser> =
        await UserService.getLoggedInUser();
      if (!res.response) {
        logout();
        return;
      }
      dispatch(setUser(res.data));
      dispatch(setAuth({ isAuthenticated: true }));
    } catch (error) {
      logout();
      logger.error("Error happen while fetching user", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) return;
    fetchUser();
  }, [isAuthenticated]);

  return { loading };
};

export default useInitUser;
