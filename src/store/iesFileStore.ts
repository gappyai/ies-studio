import { create } from 'zustand';
import type { IESFile, IESMetadata, PhotometricData, CalculatedProperties, ViewMode } from '../types/ies.types';

interface IESFileStore {
  currentFile: IESFile | null;
  editedData: Partial<IESMetadata>;
  editedPhotometricData: Partial<PhotometricData>;
  calculatedProperties: CalculatedProperties | null;
  isDirty: boolean;
  viewMode: ViewMode;
  
  // Actions
  setCurrentFile: (file: IESFile) => void;
  updateMetadata: (key: keyof IESMetadata, value: any) => void;
  updatePhotometricData: (key: keyof PhotometricData, value: any) => void;
  applyEdits: () => void;
  setCalculatedProperties: (props: CalculatedProperties) => void;
  setViewMode: (mode: ViewMode) => void;
  resetEdits: () => void;
  clearFile: () => void;
}

export const useIESFileStore = create<IESFileStore>((set) => ({
  currentFile: null,
  editedData: {},
  editedPhotometricData: {},
  calculatedProperties: null,
  isDirty: false,
  viewMode: 'overview',
  
  setCurrentFile: (file) => set({
    currentFile: file,
    editedData: {},
    editedPhotometricData: {},
    isDirty: false,
    viewMode: 'overview'
  }),
  
  updateMetadata: (key, value) => set((state) => ({
    editedData: { ...state.editedData, [key]: value },
    isDirty: true
  })),
  
  updatePhotometricData: (key, value) => set((state) => ({
    editedPhotometricData: { ...state.editedPhotometricData, [key]: value },
    isDirty: true
  })),
  
  applyEdits: () => set((state) => {
    if (!state.currentFile) return state;
    return {
      currentFile: {
        ...state.currentFile,
        metadata: { ...state.currentFile.metadata, ...state.editedData },
        photometricData: { ...state.currentFile.photometricData, ...state.editedPhotometricData }
      },
      editedData: {},
      editedPhotometricData: {},
      isDirty: false
    };
  }),
  
  setCalculatedProperties: (props) => set({ calculatedProperties: props }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  resetEdits: () => set({ editedData: {}, editedPhotometricData: {}, isDirty: false }),
  
  clearFile: () => set({
    currentFile: null,
    editedData: {},
    editedPhotometricData: {},
    calculatedProperties: null,
    isDirty: false,
    viewMode: 'overview'
  }),
}));