import { useState, useEffect } from 'react';
import { useIESFileStore } from '../store/iesFileStore';
import { photometricCalculator } from '../services/calculator';
import { saveAs } from 'file-saver';
import type { IESMetadata, PhotometricData, IESFileData } from '../types/ies.types';
import { FileUploadScreen } from '../components/unified/FileUploadScreen';
import { FileHeader } from '../components/unified/FileHeader';
import { OverviewTab } from '../components/unified/OverviewTab';
import { EditTab } from '../components/unified/EditTab';
import { ChartsTab } from '../components/unified/ChartsTab';
import { View3DTab } from '../components/unified/View3DTab';
import { Toast } from '../components/common/Toast';
import { IESFile } from '../models/IESFile';

// Helper function to merge metadata, only including non-empty values
const mergeMetadata = (
  original: IESMetadata,
  updates: Partial<IESMetadata>
): IESMetadata => {
  const merged = { ...original };
  
  // Only update fields that have non-empty values
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

export function UnifiedPage() {
  const {
    currentFile,
    editedData,
    editedPhotometricData,
    calculatedProperties,
    setCurrentFile,
    setCalculatedProperties,
    updateMetadata,
    updatePhotometricData,
    applyEdits,
    resetEdits,
    isDirty,
    setCurrentView
  } = useIESFileStore();

  const [localData, setLocalData] = useState<Partial<IESMetadata>>({});
  const [localPhotometricData, setLocalPhotometricData] = useState<Partial<PhotometricData>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'charts' | '3d'>('overview');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [downloadFilename, setDownloadFilename] = useState<string>('');

  useEffect(() => {
    if (currentFile) {
      setLocalData({ ...currentFile.metadata, ...editedData });
      setLocalPhotometricData({ ...currentFile.photometricData, ...editedPhotometricData });
      
      // Initialize download filename from LUMCAT or fallback to current filename
      const lumcat = currentFile.metadata.luminaireCatalogNumber;
      if (lumcat) {
        let initialFilename = lumcat;
        if (initialFilename.toLowerCase().endsWith('.ies')) {
          initialFilename = initialFilename.replace(/\.ies$/i, '.ies');
        } else {
          initialFilename = `${initialFilename}.ies`;
        }
        setDownloadFilename(initialFilename);
      } else {
        setDownloadFilename(currentFile.fileName.replace(/\.ies$/i, '_edited.ies'));
      }
    }
  }, [currentFile, editedData, editedPhotometricData]);

  const handleFileUpload = async (file: File) => {
    setError(null);
    
    if (!file.name.toLowerCase().endsWith('.ies')) {
      setError('Please select a valid .ies file');
      return;
    }

    try {
      const content = await file.text();
      // Use IESFile model for parsing
      const iesFile = IESFile.parse(content, file.name);
      
      const calculated = photometricCalculator.calculateProperties(iesFile.photometricData);
      
      setCurrentFile(iesFile.data);
      setCalculatedProperties(calculated);
      setActiveTab('overview'); // Reset to overview when new file is loaded
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse IES file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleMetadataChange = (key: keyof IESMetadata, value: any) => {
    setLocalData(prev => ({ ...prev, [key]: value }));
    updateMetadata(key, value);
  };

  const handlePhotometricChange = (key: keyof PhotometricData, value: any) => {
    setLocalPhotometricData(prev => ({ ...prev, [key]: value }));
    updatePhotometricData(key, value);
  };

  const handleBulkPhotometricUpdate = (updates: Partial<PhotometricData>) => {
    setLocalPhotometricData(prev => ({ ...prev, ...updates }));
    Object.entries(updates).forEach(([key, value]) => {
      updatePhotometricData(key as keyof PhotometricData, value);
    });
  };

  const handleSave = () => {
    applyEdits();
    showToastMessage('Changes saved successfully! Your edits will be applied to exports and batch generation.', 'success');
  };

  const showToastMessage = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const handleReset = () => {
    resetEdits();
    if (currentFile) {
      setLocalData(currentFile.metadata);
      setLocalPhotometricData(currentFile.photometricData);
    }
  };

  const handleDownload = () => {
    if (!currentFile) return;
    
    // Auto-save any unsaved changes before downloading
    if (isDirty) {
      applyEdits();
      showToastMessage('Changes auto-saved before download', 'info');
    }
    
    // Create a merged file with all edits applied - safely merge metadata
    // Use currentFile which should have edits applied if isDirty was true
    // Otherwise merge editedData safely
    const fileToGenerate: IESFileData = {
      ...currentFile,
      metadata: mergeMetadata(currentFile.metadata, editedData),
      photometricData: { ...currentFile.photometricData, ...editedPhotometricData }
    };
    
    // Generate IES content using IESFile model
    const iesFile = new IESFile(fileToGenerate);
    const iesContent = iesFile.write();
    const blob = new Blob([iesContent], { type: 'text/plain;charset=utf-8' });
    
    // Ensure filename has .ies extension (lowercase)
    let filename = downloadFilename;
    if (filename.toLowerCase().endsWith('.ies')) {
      filename = filename.replace(/\.ies$/i, '.ies');
    } else {
      filename = `${filename}.ies`;
    }
    saveAs(blob, filename);
    showToastMessage(`Downloaded as ${filename}`, 'success');
  };

  const handleTabChange = (tab: 'overview' | 'edit' | 'charts' | '3d') => {
    setActiveTab(tab);
    // Sync with store's current view for backward compatibility
    if (tab === 'overview' || tab === 'edit') {
      setCurrentView(tab);
    }
  };

  // If no file is loaded, show upload interface
  if (!currentFile) {
    return (
      <FileUploadScreen
        onFileSelect={handleFileSelect}
        onDrop={handleDrop}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        error={error}
      />
    );
  }

  // File is loaded, show the main interface
  return (
    <div className="p-8">
      <FileHeader
        fileName={currentFile.fileName}
        activeTab={activeTab}
        isDirty={isDirty}
        downloadFilename={downloadFilename}
        onFileSelect={handleFileSelect}
        onTabChange={handleTabChange}
        onDownload={handleDownload}
        onDownloadFilenameChange={setDownloadFilename}
        onSave={handleSave}
        onReset={handleReset}
      />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          currentFile={{
            ...currentFile,
            metadata: { ...currentFile.metadata, ...editedData },
            photometricData: { ...currentFile.photometricData, ...editedPhotometricData }
          }}
          calculatedProperties={calculatedProperties}
        />
      )}

      {activeTab === 'edit' && (
        <EditTab
          currentFile={currentFile}
          localData={localData}
          localPhotometricData={localPhotometricData}
          isDirty={isDirty}
          onMetadataChange={handleMetadataChange}
          onPhotometricChange={handlePhotometricChange}
          onBulkPhotometricUpdate={handleBulkPhotometricUpdate}
          onToast={showToastMessage}
        />
      )}

      {activeTab === 'charts' && (
        <ChartsTab photometricData={{ ...currentFile.photometricData, ...editedPhotometricData }} />
      )}

      {activeTab === '3d' && (
        <View3DTab photometricData={{ ...currentFile.photometricData, ...editedPhotometricData }} />
      )}

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
