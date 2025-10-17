import { useState, useEffect } from 'react';
import { Save, RotateCcw, Download, Edit3, Eye, FileText, Upload, Settings, Grid, BarChart3 } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import { iesParser } from '../services/iesParser';
import { photometricCalculator } from '../services/calculator';
import { saveAs } from 'file-saver';
import type { IESMetadata, PhotometricData } from '../types/ies.types';
import { IntegratedPhotometricEditor } from '../components/common/IntegratedPhotometricEditor';

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
    currentView,
    setCurrentView
  } = useIESFileStore();

  const [localData, setLocalData] = useState<Partial<IESMetadata>>({});
  const [localPhotometricData, setLocalPhotometricData] = useState<Partial<PhotometricData>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentFile) {
      setLocalData({ ...currentFile.metadata, ...editedData });
      setLocalPhotometricData({ ...currentFile.photometricData, ...editedPhotometricData });
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
      const parsedFile = iesParser.parse(content, file.name, file.size);
      const calculated = photometricCalculator.calculateProperties(parsedFile.photometricData);
      
      setCurrentFile(parsedFile);
      setCalculatedProperties(calculated);
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

  const handleChange = (key: keyof IESMetadata, value: any) => {
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
    alert('Changes saved successfully! Your edits will be applied to exports and batch generation.');
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
    const iesContent = iesGenerator.generate(currentFile);
    const blob = new Blob([iesContent], { type: 'text/plain;charset=utf-8' });
    const filename = currentFile.fileName.replace(/\.(ies|IES)$/, '_edited.ies');
    saveAs(blob, filename);
  };

  const toggleView = () => {
    setCurrentView(currentView === 'overview' ? 'edit' : 'overview');
  };

  // If no file is loaded, show upload interface
  if (!currentFile) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              IES Studio
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Professional IES file editing and batch processing tool
            </p>
            
            {/* Primary File Selection Button */}
            <div className="mb-8">
              <label className="inline-block">
                <input
                  type="file"
                  accept=".ies,.IES"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <span className="px-8 py-4 bg-primary text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors inline-flex items-center gap-3 text-lg font-medium">
                  <Upload className="w-6 h-6" />
                  Select IES File
                </span>
              </label>
            </div>

            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors max-w-2xl mx-auto ${
                isDragging
                  ? 'border-primary bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Or drop your IES file here
              </h3>
              <p className="text-sm text-gray-600">
                Supports .ies and .IES formats
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl mx-auto">
              {error}
            </div>
          )}

          {/* Feature Cards */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <FileText className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold text-gray-900 mb-2">View & Edit</h4>
              <p className="text-sm text-gray-600">Analyze photometric data and edit metadata</p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <Settings className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold text-gray-900 mb-2">Batch Process</h4>
              <p className="text-sm text-gray-600">Update metadata for multiple files at once</p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <Grid className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold text-gray-900 mb-2">Generate Variants</h4>
              <p className="text-sm text-gray-600">Create multiple IES file variants</p>
            </div>
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold text-gray-900 mb-2">Visualize</h4>
              <p className="text-sm text-gray-600">Charts and 3D photometric visualization</p>
            </div>
          </div>

          {/* Batch Processing CTA */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">Need to process multiple files?</p>
            <a
              href="#/batch"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              <Settings className="w-5 h-5" />
              Go to Batch Processing
            </a>
          </div>
        </div>
      </div>
    );
  }

  // File is loaded, show the main interface
  return (
    <div className="p-8">
      {/* Header with View Toggle and Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentView === 'overview' ? 'Overview' : 'Edit Luminaire'}
          </h1>
          <button
            onClick={toggleView}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {currentView === 'overview' ? (
              <>
                <Edit3 className="w-4 h-4" />
                Edit Mode
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                View Mode
              </>
            )}
          </button>
          {/* File Selection Widget - Always visible when file is loaded */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{currentFile.fileName}</span>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".ies,.IES"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="text-xs text-blue-600 hover:text-blue-800 underline ml-2">
                Change File
              </span>
            </label>
          </div>
        </div>
        
        <div className="flex gap-3">
          {/* New File Button */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".ies,.IES"
              onChange={handleFileSelect}
              className="hidden"
            />
            <span className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
              <Upload className="w-4 h-4" />
              New File
            </span>
          </label>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          {currentView === 'edit' && (
            <>
              <button
                onClick={handleReset}
                disabled={!isDirty}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      {currentView === 'overview' ? (
        /* Overview View */
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">File Name</h3>
              <p className="text-2xl font-bold text-gray-900">{currentFile.fileName}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Output</h3>
              <p className="text-2xl font-bold text-gray-900">
                {currentFile.photometricData.totalLumens.toFixed(1)} lm
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Peak Intensity</h3>
              <p className="text-2xl font-bold text-gray-900">
                {calculatedProperties?.peakIntensity.toFixed(2)} cd
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Power</h3>
              <p className="text-2xl font-bold text-gray-900">
                {currentFile.photometricData.inputWatts.toFixed(1)} W
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Efficacy</h3>
              <p className="text-2xl font-bold text-gray-900">
                {calculatedProperties?.efficacy.toFixed(1)} lm/W
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Symmetry</h3>
              <p className="text-2xl font-bold text-gray-900 capitalize">
                {calculatedProperties?.symmetry}
              </p>
            </div>
          </div>

          {/* Test Information */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Test</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.test || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Test Lab</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.testLab || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Test Date</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.testDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Issue Date</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.issueDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lamp Position</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.lampPosition || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Other</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.other || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Luminaire Information */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Luminaire Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Manufacturer</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.manufacturer || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Luminaire Description</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.luminaireDescription || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lamp Catalog #</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.lampCatalogNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Luminaire Catalog #</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.luminaireCatalogNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ballast Description</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.ballastDescription || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ballast Catalog #</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.ballastCatalogNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CCT</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.colorTemperature ? `${currentFile.metadata.colorTemperature}K` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CRI</p>
                <p className="font-medium text-gray-900">{currentFile.metadata.colorRenderingIndex || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Photometric Data */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Photometric Data</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Number of Lamps</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.numberOfLamps}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lumens Per Lamp</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.lumensPerLamp.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Multiplier</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.multiplier}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tilt</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.tiltOfLuminaire}°</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Photometric Type</p>
                <p className="font-medium text-gray-900">
                  {currentFile.photometricData.photometricType === 1 ? 'Type C' : 
                   currentFile.photometricData.photometricType === 2 ? 'Type B' : 'Type A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Units</p>
                <p className="font-medium text-gray-900">
                  {currentFile.photometricData.unitsType === 1 ? 'Feet' : 'Meters'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vertical Angles</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.numberOfVerticalAngles}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Horizontal Angles</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.numberOfHorizontalAngles}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ballast Factor</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.ballastFactor}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ballast-Lamp Factor</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.ballastLampPhotometricFactor}</p>
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Luminous Dimensions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Width</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.width} m</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Length</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.length} m</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Height</p>
                <p className="font-medium text-gray-900">{currentFile.photometricData.height} m</p>
              </div>
            </div>
          </div>

          {/* Calculated Properties */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Calculated Properties</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Beam Angle</p>
                <p className="font-medium text-gray-900">{calculatedProperties?.beamAngle.toFixed(1)}°</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Field Angle</p>
                <p className="font-medium text-gray-900">{calculatedProperties?.fieldAngle.toFixed(1)}°</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">LOR</p>
                <p className="font-medium text-gray-900">{calculatedProperties?.lor}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Center Beam Intensity</p>
                <p className="font-medium text-gray-900">{calculatedProperties?.centerBeamIntensity.toFixed(2)} cd</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Edit View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Luminaire Information */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test
                  </label>
                  <input
                    type="text"
                    value={localData.test || ''}
                    onChange={(e) => handleChange('test', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Lab
                  </label>
                  <input
                    type="text"
                    value={localData.testLab || ''}
                    onChange={(e) => handleChange('testLab', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Date
                  </label>
                  <input
                    type="text"
                    value={localData.testDate || ''}
                    onChange={(e) => handleChange('testDate', e.target.value)}
                    placeholder="MM/DD/YYYY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="text"
                    value={localData.issueDate || ''}
                    onChange={(e) => handleChange('issueDate', e.target.value)}
                    placeholder="MM/DD/YYYY HH:MM:SS"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lamp Position
                  </label>
                  <input
                    type="text"
                    value={localData.lampPosition || ''}
                    onChange={(e) => handleChange('lampPosition', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Other
                  </label>
                  <input
                    type="text"
                    value={localData.other || ''}
                    onChange={(e) => handleChange('other', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Luminaire Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={localData.manufacturer || ''}
                    onChange={(e) => handleChange('manufacturer', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Luminaire Description
                  </label>
                  <input
                    type="text"
                    value={localData.luminaireDescription || ''}
                    onChange={(e) => handleChange('luminaireDescription', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Luminaire Catalog Number
                  </label>
                  <input
                    type="text"
                    value={localData.luminaireCatalogNumber || ''}
                    onChange={(e) => handleChange('luminaireCatalogNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lamp Catalog Number
                  </label>
                  <input
                    type="text"
                    value={localData.lampCatalogNumber || ''}
                    onChange={(e) => handleChange('lampCatalogNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ballast Description
                  </label>
                  <input
                    type="text"
                    value={localData.ballastDescription || ''}
                    onChange={(e) => handleChange('ballastDescription', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ballast Catalog Number
                  </label>
                  <input
                    type="text"
                    value={localData.ballastCatalogNumber || ''}
                    onChange={(e) => handleChange('ballastCatalogNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Light Properties</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CRI (Color Rendering Index)
                  </label>
                  <input
                    type="number"
                    value={localData.colorRenderingIndex || ''}
                    onChange={(e) => handleChange('colorRenderingIndex', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Integrated Photometric Editor */}
          <div className="space-y-6">
            <IntegratedPhotometricEditor
              currentPhotometricData={{ ...currentFile.photometricData, ...localPhotometricData }}
              onPhotometricUpdate={handlePhotometricChange}
              onBulkUpdate={handleBulkPhotometricUpdate}
              onCCTUpdate={(cct) => handleChange('colorTemperature', cct)}
            />

            {isDirty && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Unsaved changes:</strong> Click "Save Changes" to apply your edits.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}