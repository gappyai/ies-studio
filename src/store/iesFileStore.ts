import { create } from 'zustand';
import type { IESFileData, IESMetadata, PhotometricData, CalculatedProperties, ViewMode } from '../types/ies.types';

export interface BatchFile extends IESFileData {
  id: string;
  metadataUpdates?: Partial<IESMetadata>;
}

// Removed CSVMetadata interface

interface IESFileStore {
  currentFile: IESFileData | null;
  editedData: Partial<IESMetadata>;
  editedPhotometricData: Partial<PhotometricData>;
  calculatedProperties: CalculatedProperties | null;
  isDirty: boolean;
  viewMode: ViewMode;
  // Batch operations
  batchFiles: BatchFile[];
  currentView: 'overview' | 'edit';
  
  // Actions
  setCurrentFile: (file: IESFileData) => void;
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
    
    // Helper to merge metadata, only including non-empty values
    const mergeMetadata = (original: IESMetadata, updates: Partial<IESMetadata>): IESMetadata => {
      const merged = { ...original };
      
      (Object.keys(updates) as Array<keyof IESMetadata>).forEach((key) => {
        const value = updates[key];
        
        // For string fields, only update if value is non-empty
        if (typeof value === 'string') {
          if (value.trim() !== '') {
            (merged as any)[key] = value;
          }
        } 
        // For number fields, only update if value is defined and not NaN
        else if (typeof value === 'number') {
          if (!isNaN(value) && value !== undefined) {
            (merged as any)[key] = value;
          }
        }
        // For other types, update if value is truthy
        else if (value !== undefined && value !== null) {
          (merged as any)[key] = value;
        }
      });
      
      return merged;
    };
    
    return {
      currentFile: {
        ...state.currentFile,
        metadata: mergeMetadata(state.currentFile.metadata, state.editedData),
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
  
  clearBatchFiles: () => set({ batchFiles: [] }),
  
  updateBatchFileMetadata: (fileId, metadata) => set((state) => ({
    batchFiles: state.batchFiles.map(file =>
      file.id === fileId
        ? { ...file, metadataUpdates: { ...file.metadataUpdates, ...metadata } }
        : file
    )
  })),
  
  setCurrentView: (view) => set({ currentView: view }),
}));
