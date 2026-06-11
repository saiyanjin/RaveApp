import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  records: [], // Tableau d'objets: { id, name, uri, timestamp }
};

const recordSlice = createSlice({
  name: 'records',
  initialState,
  reducers: {
    addRecord: (state, action) => {
      state.records.push(action.payload);
    },
    deleteRecord: (state, action) => {
      state.records = state.records.filter(record => record.id !== action.payload);
    },
  },
});

export const { addRecord, deleteRecord } = recordSlice.actions;
export default recordSlice.reducer;