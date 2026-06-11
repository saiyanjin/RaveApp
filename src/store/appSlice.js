import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  ip: '',
  port: '',
  isConnected: false,
  models: [],
  selectedModel: '',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setServerConfig: (state, action) => {
      state.ip = action.payload.ip;
      state.port = action.payload.port;
    },
    setConnectionStatus: (state, action) => {
      state.isConnected = action.payload;
    },
    setModels: (state, action) => {
      state.models = action.payload;
    },
    setSelectedModel: (state, action) => {
      state.selectedModel = action.payload;
    },
  },
});

export const { setServerConfig, setConnectionStatus, setModels, setSelectedModel } = appSlice.actions;
export default appSlice.reducer;