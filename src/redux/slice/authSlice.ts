import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthState } from "../../types/global";
import { AUTH_VARS } from "../../utils/constants/app";

const initialState: AuthState = {
  [AUTH_VARS.ACCESS]: "",
  [AUTH_VARS.REFRESH]: "",
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<Partial<AuthState>>) => {
      return { ...state, ...action.payload };
    },
    clearAuth: (state) => {
      return { ...state, ...initialState };
    },
  },
});

const authReduce = authSlice.reducer;

export const { setAuth, clearAuth } = authSlice.actions;

export default authReduce;
