import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import appReducer from './appSlice';
import recordReducer from './recordSlice';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const storage = Platform.OS === 'web'
  ? require('redux-persist/lib/storage').default
  : AsyncStorage;

const rootReducer = combineReducers({
  app: appReducer,
  records: recordReducer,
});

const persistConfig = {
  key: 'root',
  storage: storage,  // ← utilise la variable, pas AsyncStorage directement
  whitelist: ['app', 'records'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);