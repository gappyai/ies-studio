import { create } from 'zustand';
import type { IESFile, IESMetadata, PhotometricData, CalculatedProperties, ViewMode } from '../types/ies.types';

export interface BatchFile extends IESFile {
  id: string;
  metadataUpdates?: Partial<IESMetadata>;
}

export interface CSVMetadata {
  [filename: string]: Partial<IESMetadata>;
}

interface IESFileStore {
  currentFile: IESFile | null;
  editedData: Partial<IESMetadata>;
  editedPhotometricData: Partial<PhotometricData>;
  calculatedProperties: CalculatedProperties | null;
  isDirty: boolean;
  viewMode: ViewMode;
  // Batch operations
  batchFiles: BatchFile[];
  csvMetadata: CSVMetadata;
  currentView: 'overview' | 'edit';
  
  // Actions
  setCurrentFile: (file: IESFile) => void;
  updateMetadata: (key: keyof IESMetadata, value: any) => void;
  updatePhotometricData: (key: keyof PhotometricData, value: any) => void;
  applyEdits: () => void;
  setCalculatedProperties: (props: CalculatedProperties) => void;
  setViewMode: (mode: ViewMode) => void;
  resetEdits: () => void;
  clearFile: () => void;
  // Batch operations
  addBatchFiles: (files: BatchFile[]) => void;
  clearBatchFiles: () => void;
  setCSVMetadata: (metadata: CSVMetadata) => void;
  updateBatchFileMetadata: (fileId: string, metadata: Partial<IESMetadata>) => void;
  setCurrentView: (view: 'overview' | 'edit') => void;
}

export const useIESFileStore = create<IESFileStore>((set) => ({
  currentFile: null,
  editedData: {},
  editedPhotometricData: {},
  calculatedProperties: null,
  isDirty: false,
  viewMode: 'overview',
  batchFiles: [],
  csvMetadata: {},
  currentView: 'overview',
  
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
    viewMode: 'overview',
    currentView: 'overview'
  }),
  
  // Batch operations
  addBatchFiles: (files) => set({ batchFiles: files }),
  
  clearBatchFiles: () => set({ batchFiles: [], csvMetadata: {} }),
  
  setCSVMetadata: (metadata) => set({ csvMetadata: metadata }),
  
  updateBatchFileMetadata: (fileId, metadata) => set((state) => ({
    batchFiles: state.batchFiles.map(file =>
      file.id === fileId
        ? { ...file, metadataUpdates: { ...file.metadataUpdates, ...metadata } }
        : file
    )
  })),
  
  setCurrentView: (view) => set({ currentView: view }),
}));