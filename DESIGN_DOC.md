# IES Studio - Design Document

## 1. Project Overview

**IES Studio** is a web-based application for viewing, editing, and managing IES (Illuminating Engineering Society) photometric files. The application provides an intuitive interface for lighting professionals to analyze, modify, and generate multiple IES files from a single base file.

### 1.1 Core Objectives
- Provide a seamless IES file viewing and editing experience
- Enable visualization of photometric data through multiple chart types
- Support creation of multiple variant files from a base IES file
- Eliminate the need for user authentication (standalone tool)
- Deliver a fast, responsive React-based interface

---

## 2. Feature Set

### 2.1 Phase 1 (MVP - Initial Release)

#### 2.1.1 File Management
- **File Upload/Selection**
  - Drag-and-drop interface for IES file upload
  - Click-to-browse file selection
  - Support for `.ies` and `.IES` file extensions
  - File validation and error handling
  - Sample file library for testing

#### 2.1.2 Overview Page
- **Details Panel**
  - Output (lumens)
  - Peak intensity (candela)
  - Power consumption (watts)
  - Efficacy (lm/W) - calculated
  - Manufacturer information
  - Product name
  - Date and time
  - Lamp type
  - Physical and luminous dimensions
  - Symmetry information
  - Beam angle
  - LOR (Light Output Ratio)

- **Visualization Charts**
  - **Polar Plot**: Circular representation of light distribution
  - **Linear Plot**: Vertical intensity distribution chart
  - **Iso-Candela Plot**: Contour map of light intensity
  - **Iso-Illuminance Plot**: Color-coded illuminance levels

#### 2.1.3 Edit Page
- **Luminaire Information**
  - Manufacturer (text input)
  - Luminaire name (text input)
  - Date (date picker)
  - Lamp catalog number (text input)

- **Photometric Properties**
  - Output (lumens) - number input with validation
  - Peak intensity (candela) - calculated/editable
  - Power (watts) - number input
  - Color temperature (kelvin) - number input
  - Color Rendering Index (CRI) - number input (0-100)

- **Dimensions**
  - Luminous dimensions (diameter, length, height in cm)
  - Physical dimensions (diameter, length, height in cm)
  - Support for "NaN" or empty values for non-applicable dimensions

- **Luminaire Type**
  - Dropdown selection for lamp geometry
  - Options: Point, Linear, Rectangle, Circular, Sphere, etc.

#### 2.1.4 3D Visualization
- Interactive 3D light distribution model
- Color-gradient representation of intensity
- Rotation and zoom controls
- Grid overlay for spatial reference
- Multiple viewing angles
- Real-time updates when parameters change

#### 2.1.5 Batch File Generator (Unique Feature)
- **Input Parameters**
  - Base IES file selection
  - Parameter variations:
    - Lumen output range (min, max, step)
    - Physical dimensions (length, width, height)
    - Custom naming pattern
    - Number of variants to generate
  
- **Generation Logic**
  - Scale photometric data based on lumen ratios
  - Update physical dimensions in metadata
  - Maintain angular distribution patterns
  - Generate unique filenames based on pattern
  
- **Output**
  - Batch download as ZIP file
  - Individual file download option
  - Preview of generated files before download
  - Summary table showing all variants

#### 2.1.6 Export/Download
- Export edited IES file
- Download original unmodified file
- Support for IES format (LDT format in future)

### 2.2 Phase 2 (Future Enhancements)
- PDF report generation
- LDT file format support
- TM33-18 format export
- UGR table calculations
- Batch import/export
- File comparison tool
- Cloud storage integration
- Collaborative features

---

## 3. Technical Architecture

### 3.1 Technology Stack

#### Frontend Framework
- **React 18+** with functional components and hooks
- **TypeScript** for type safety and better developer experience
- **Vite** as build tool for fast development and optimized builds

#### State Management
- **Zustand** or **Redux Toolkit** for global state management
- React Context API for theme/settings
- Local component state for UI interactions

#### Routing
- **React Router v6** for client-side navigation

#### UI Framework & Styling
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** or **Material-UI (MUI)** for component library
- **Framer Motion** for animations and transitions

#### Data Visualization
- **Recharts** or **Victory** for 2D charts (polar, linear plots)
- **Three.js** with **React Three Fiber** for 3D visualization
- **D3.js** for complex custom visualizations

#### File Processing
- Custom IES parser library (or existing npm package if available)
- **JSZip** for batch file ZIP generation
- **File-Saver** for client-side file downloads

#### Development Tools
- **ESLint** and **Prettier** for code quality
- **Vitest** or **Jest** for unit testing
- **React Testing Library** for component testing

### 3.2 Application Architecture

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Buttons, inputs, modals
│   ├── charts/          # Visualization components
│   ├── layout/          # Header, sidebar, footer
│   └── file-upload/     # File handling components
├── pages/               # Route-based page components
│   ├── HomePage.tsx
│   ├── OverviewPage.tsx
│   ├── EditPage.tsx
│   ├── View3DPage.tsx
│   ├── BatchGeneratorPage.tsx
│   └── ExportPage.tsx
├── services/            # Business logic
│   ├── iesParser.ts     # IES file parsing
│   ├── iesGenerator.ts  # IES file generation
│   ├── calculator.ts    # Photometric calculations
│   └── batchGenerator.ts # Batch file creation
├── store/               # State management
│   ├── iesFileStore.ts  # Current file state
│   ├── editorStore.ts   # Edit mode state
│   └── uiStore.ts       # UI preferences
├── types/               # TypeScript definitions
│   ├── ies.types.ts
│   └── app.types.ts
├── utils/               # Helper functions
│   ├── validators.ts
│   ├── formatters.ts
│   └── constants.ts
├── hooks/               # Custom React hooks
│   ├── useIESFile.ts
│   ├── useChartData.ts
│   └── use3DModel.ts
└── App.tsx              # Root component
```

---

## 4. Data Models

### 4.1 IES File Structure

```typescript
interface IESFile {
  metadata: IESMetadata;
  photometricData: PhotometricData;
  rawContent: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
}

interface IESMetadata {
  format: string; // e.g., "IESNA:LM-63-2002"
  test?: string;
  testLab?: string;
  manufacturer: string;
  luminaireCatalogNumber: string;
  lampCatalogNumber: string;
  issueDate: string;
  luminaireDescription?: string;
  luminousOpeningLength: number;
  luminousOpeningWidth: number;
  luminousOpeningHeight: number;
  physicalLength: number;
  physicalWidth: number;
  physicalHeight: number;
  ballastCatalogNumber?: string;
  ballastDescription?: string;
  colorTemperature?: number;
  colorRenderingIndex?: number;
}

interface PhotometricData {
  numberOfLamps: number;
  lumensPerLamp: number;
  totalLumens: number;
  multiplier: number;
  tiltOfLuminaire: number;
  numberOfVerticalAngles: number;
  numberOfHorizontalAngles: number;
  photometricType: number; // 1=Type C, 2=Type B, 3=Type A
  unitsType: number; // 1=feet, 2=meters
  width: number;
  length: number;
  height: number;
  ballastFactor: number;
  ballastLampPhotometricFactor: number;
  inputWatts: number;
  verticalAngles: number[];
  horizontalAngles: number[];
  candelaValues: number[][];  // [horizontal][vertical]
}

interface CalculatedProperties {
  peakIntensity: number;
  efficacy: number; // lumens per watt
  beamAngle: number;
  fieldAngle: number;
  lor: number; // Light Output Ratio
  symmetry: 'rotational' | 'symmetric' | 'asymmetric';
  centerBeamIntensity: number;
}
```

### 4.2 Application State

```typescript
interface AppState {
  currentFile: IESFile | null;
  editedData: Partial<IESMetadata>;
  calculatedProperties: CalculatedProperties;
  isDirty: boolean; // Has user made edits?
  viewMode: 'overview' | 'edit' | '3d' | 'batch' | 'export';
  uiSettings: UISettings;
}

interface UISettings {
  theme: 'light' | 'dark';
  chartColors: string[];
  gridVisible: boolean;
  measurementUnit: 'metric' | 'imperial';
}

interface BatchGeneratorState {
  baseFile: IESFile;
  parameters: BatchParameters;
  generatedFiles: IESFile[];
  previewIndex: number;
}

interface BatchParameters {
  lumenRange: {
    min: number;
    max: number;
    step: number;
  };
  dimensions: {
    length?: number[];
    width?: number[];
    height?: number[];
  };
  namingPattern: string; // e.g., "{base}_{lumens}lm_{length}x{width}"
  outputCount: number;
}
```

---

## 5. Page Structure & Navigation

### 5.1 Navigation Flow

```
Home (File Upload)
    ↓
Overview (Auto-navigate after upload)
    ↓
[Sidebar Navigation]
├── Overview (Home icon)
├── Edit (Pencil icon)
├── 3D View (3D cube icon)
├── Batch Generator (Multiple files icon) *NEW*
└── Export (Download icon)
```

### 5.2 Page Details

#### 5.2.1 Home Page
- **Purpose**: File selection entry point
- **Components**:
  - Drag-drop zone (centered, prominent)
  - Browse button
  - Sample files gallery (3-4 demo files)
  - Quick info about supported formats
  - Recent files (stored in localStorage - optional)

#### 5.2.2 Overview Page
- **Layout**: Grid layout with responsive cards
- **Sections**:
  - Top: Details card (1/4 width)
  - Center: Large visualization area
  - Tabs or cards for different chart types
  - Bottom: Quick actions (Edit, Export)

#### 5.2.3 Edit Page
- **Layout**: Two-column form layout
- **Left Column**:
  - Luminaire details
  - Photometric properties
- **Right Column**:
  - Dimensions
  - Luminaire type
  - Live preview of key metrics
- **Footer**: Save/Reset buttons

#### 5.2.4 3D View Page
- **Layout**: Full-screen canvas with overlay controls
- **Features**:
  - 3D rendering area (main focus)
  - Control panel (top-right)
    - Rotation controls
    - Zoom slider
    - View presets (top, side, isometric)
    - Grid toggle
    - Color scheme selector
  - Information overlay (bottom-left)
    - Current view angle
    - Peak intensity indicator

#### 5.2.5 Batch Generator Page (NEW)
- **Layout**: Step-by-step wizard interface
- **Step 1**: Base file confirmation
- **Step 2**: Parameter configuration
  - Lumen range inputs
  - Dimension selectors
  - Naming pattern builder
- **Step 3**: Preview & validation
  - Table showing all variants
  - Sample file preview
  - Validation warnings
- **Step 4**: Generation & download
  - Progress indicator
  - Download ZIP or individual files

#### 5.2.6 Export Page
- **Layout**: Simple centered card
- **Options**:
  - IES file download (edited)
  - Original file download
  - Raw text view
  - Copy to clipboard option

---

## 6. Component Architecture

### 6.1 Key Components

#### FileUpload Component
```typescript
<FileUploadZone
  onFileSelect={(file) => handleFileUpload(file)}
  acceptedFormats={['.ies', '.IES']}
  maxSize={5} // MB
  showPreview={false}
/>
```

#### Chart Components
```typescript
<PolarPlot
  data={candelaValues}
  verticalAngles={verticalAngles}
  horizontalAngles={horizontalAngles}
  colorScheme="rainbow"
/>

<LinearPlot
  data={verticalSlice}
  angles={verticalAngles}
  showGrid={true}
/>

<IsoCandelaPlot
  data={candelaValues}
  contourLevels={[10, 30, 50, 70, 90]}
/>
```

#### 3D Visualization Component
```typescript
<Light3DViewer
  photometricData={currentFile.photometricData}
  viewAngle={viewAngle}
  gridVisible={showGrid}
  colorMap="thermal"
  onRotate={(angle) => setViewAngle(angle)}
/>
```

#### Edit Form Components
```typescript
<EditableField
  label="Manufacturer"
  value={metadata.manufacturer}
  onChange={(value) => updateMetadata('manufacturer', value)}
  validation={validateText}
/>

<NumericInput
  label="Output (lumens)"
  value={photometricData.totalLumens}
  onChange={(value) => updatePhotometric('totalLumens', value)}
  min={0}
  step={10}
  unit="lm"
/>
```

#### Batch Generator Component
```typescript
<BatchGenerator
  baseFile={currentFile}
  onGenerate={(files) => handleBatchGeneration(files)}
  parameters={batchParams}
/>
```

---

## 7. IES File Parsing & Generation

### 7.1 Parser Implementation

```typescript
class IESParser {
  parse(fileContent: string): IESFile {
    // Parse header (keywords)
    const metadata = this.parseMetadata(fileContent);
    
    // Parse TILT section
    const tiltData = this.parseTilt(fileContent);
    
    // Parse photometric data
    const photometricData = this.parsePhotometricData(fileContent);
    
    return {
      metadata,
      photometricData,
      rawContent: fileContent,
      // ... other properties
    };
  }
  
  private parseMetadata(content: string): IESMetadata {
    // Extract lines starting with [keywords]
    // Parse according to IESNA:LM-63 format
  }
  
  private parsePhotometricData(content: string): PhotometricData {
    // Parse numeric data section
    // Build candela array
  }
}
```

### 7.2 Generator Implementation

```typescript
class IESGenerator {
  generate(file: IESFile): string {
    // Rebuild IES format string
    const header = this.buildHeader(file.metadata);
    const photometric = this.buildPhotometricSection(file.photometricData);
    
    return `${header}\n${photometric}`;
  }
  
  generateVariant(
    baseFile: IESFile,
    params: VariantParameters
  ): IESFile {
    // Clone base file
    const variant = { ...baseFile };
    
    // Scale lumen values
    const ratio = params.targetLumens / baseFile.photometricData.totalLumens;
    variant.photometricData.candelaValues = this.scaleCandelaValues(
      baseFile.photometricData.candelaValues,
      ratio
    );
    
    // Update dimensions
    variant.metadata.physicalLength = params.length || variant.metadata.physicalLength;
    // ... update other dimensions
    
    return variant;
  }
}
```

---

## 8. Calculation Engine

### 8.1 Derived Calculations

```typescript
class PhotometricCalculator {
  calculateEfficacy(lumens: number, watts: number): number {
    return watts > 0 ? lumens / watts : 0;
  }
  
  calculatePeakIntensity(candelaValues: number[][]): number {
    let max = 0;
    for (const row of candelaValues) {
      max = Math.max(max, ...row);
    }
    return max;
  }
  
  calculateBeamAngle(
    candelaValues: number[][],
    verticalAngles: number[],
    threshold: number = 0.5
  ): number {
    const peak = this.calculatePeakIntensity(candelaValues);
    const cutoff = peak * threshold;
    
    // Find angle where intensity drops to cutoff
    // Implementation depends on data structure
  }
  
  determineSymmetry(
    candelaValues: number[][],
    horizontalAngles: number[]
  ): 'rotational' | 'symmetric' | 'asymmetric' {
    // Analyze candela distribution pattern
    // Check for rotational symmetry, bilateral symmetry, or asymmetry
  }
}
```

---

## 9. User Interface Design

### 9.1 Design Principles
- **Clean & Minimal**: Focus on data visualization
- **Professional**: Suitable for engineering/technical audience
- **Responsive**: Works on desktop and tablet (mobile view optional)
- **Accessible**: WCAG 2.1 AA compliance
- **Fast**: Optimized rendering for large datasets

### 9.2 Color Scheme
- **Primary**: Blue (#3B82F6) - for actions and highlights
- **Secondary**: Gray (#6B7280) - for text and borders
- **Success**: Green (#10B981) - for confirmations
- **Warning**: Amber (#F59E0B) - for validation warnings
- **Error**: Red (#EF4444) - for errors
- **Chart Colors**: Rainbow gradient for intensity visualization

### 9.3 Typography
- **Headings**: Inter or Poppins (600/700 weight)
- **Body**: Inter or Open Sans (400/500 weight)
- **Monospace**: JetBrains Mono or Fira Code (for file view)

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup with Vite + React + TypeScript
- [ ] Basic routing structure
- [ ] UI component library integration
- [ ] IES parser implementation
- [ ] File upload functionality
- [ ] Basic state management setup

### Phase 2: Core Viewing (Weeks 3-4)
- [ ] Overview page layout
- [ ] Details panel implementation
- [ ] Polar plot chart
- [ ] Linear plot chart
- [ ] Iso-candela plot
- [ ] Calculation engine for derived metrics

### Phase 3: Editing (Week 5)
- [ ] Edit page layout
- [ ] Form components with validation
- [ ] Real-time preview updates
- [ ] Save/reset functionality
- [ ] IES file regeneration

### Phase 4: 3D Visualization (Week 6)
- [ ] Three.js integration
- [ ] 3D model generation from photometric data
- [ ] Interactive controls
- [ ] View presets
- [ ] Performance optimization

### Phase 5: Batch Generator (Week 7)
- [ ] Wizard interface
- [ ] Parameter configuration UI
- [ ] Variant generation logic
- [ ] Preview functionality
- [ ] ZIP file creation and download

### Phase 6: Polish & Testing (Week 8)
- [ ] Export functionality
- [ ] Error handling and validation
- [ ] Unit tests for critical functions
- [ ] E2E testing
- [ ] Performance optimization
- [ ] Documentation

---

## 11. Testing Strategy

### 11.1 Unit Tests
- IES parser accuracy
- Calculation engine correctness
- Variant generation logic
- Data validators

### 11.2 Component Tests
- File upload flow
- Chart rendering
- Form interactions
- 3D viewer controls

### 11.3 Integration Tests
- End-to-end file processing
- Edit-to-export workflow
- Batch generation flow

### 11.4 Performance Tests
- Large IES file handling
- Chart rendering speed
- 3D model performance
- Batch generation with many variants

---

## 12. Deployment

### 12.1 Build Configuration
- Production build optimization
- Code splitting for faster loading
- Asset optimization (images, fonts)
- Environment variables setup

### 12.2 Hosting Options
- **Vercel** (recommended for React apps)
- **Netlify**
- **GitHub Pages**
- **AWS S3 + CloudFront**

### 12.3 CI/CD Pipeline
- Automated testing on push
- Build validation
- Automatic deployment to staging
- Manual approval for production

---

## 13. Future Enhancements

### 13.1 Advanced Features
- **PDF Report Generation**: Professional photometric reports
- **LDT Format Support**: European standard format
- **File Comparison**: Side-by-side comparison of two IES files
- **Batch Import**: Process multiple files at once
- **Advanced Calculations**: UGR tables, illuminance calculations
- **Custom Annotations**: Add notes and markers to visualizations

### 13.2 Collaboration Features
- **Shareable Links**: Share files via URL (with server backend)
- **Comments**: Annotation and discussion system
- **Version History**: Track changes over time
- **Team Workspaces**: Shared file libraries

### 13.3 Integration Options
- **API**: REST API for programmatic access
- **Plugins**: Extensions for popular lighting design software
- **Cloud Storage**: Google Drive, Dropbox integration
- **Export Formats**: Excel, CSV for data analysis

---

## 14. Technical Considerations

### 14.1 Performance
- Lazy load charts and 3D components
- Use Web Workers for heavy calculations
- Implement virtual scrolling for large datasets
- Cache parsed IES data in memory
- Optimize Three.js rendering

### 14.2 Browser Compatibility
- Target modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ JavaScript features
- WebGL support required for 3D
- Fallback for older browsers (message only)

### 14.3 Security
- Client-side only processing (no server uploads)
- Input validation for all user data
- Sanitize file content before parsing
- XSS protection in React
- No sensitive data storage

### 14.4 Accessibility
- Keyboard navigation support
- Screen reader compatibility
- ARIA labels for interactive elements
- Color contrast compliance
- Alt text for visual elements

---

## 15. Success Metrics

### 15.1 User Metrics
- File upload success rate
- Average session duration
- Feature usage statistics
- Batch generator adoption rate

### 15.2 Technical Metrics
- Page load time < 2s
- Chart render time < 500ms
- 3D model load time < 1s
- Zero parsing errors for valid IES files

### 15.3 Quality Metrics
- Test coverage > 80%
- Zero critical bugs
- Lighthouse score > 90
- WCAG AA compliance

---

## 16. Documentation Requirements

### 16.1 User Documentation
- Getting started guide
- Feature tutorials (video/text)
- IES format explanation
- Batch generator use cases
- FAQ section

### 16.2 Developer Documentation
- Setup instructions
- Architecture overview
- Component API documentation
- Contribution guidelines
- Deployment guide

---

## Appendix A: Sample IES File Structure

```
IESNA:LM-63-2002
[TEST] Serial: 1100489855
[TESTLAB] Test lab
[MANUFAC] Demo Manufacturer
[LUMCAT] 123456
[LUMINAIRE] Demo LED Bulb 7W
[LAMPCAT] LED
[LAMP] LED
TILT=NONE
1 381 1 21 1 1 1 -1 0 0
1 1 60
0 5 10 15 20 25 30 35 40 45 50 55 60 65 70 75 80 85 90
0
53.8 53.8 53.8 53.8 53.6 53.3 52.8 51.9 50.7 49.0 46.7
43.9 40.4 36.3 31.6 26.5 21.1 15.4 9.6 3.8 0.0
```

---

## Appendix B: Technology Alternatives

### State Management
- **Zustand** (recommended): Lightweight, simple API
- **Redux Toolkit**: More boilerplate, but powerful dev tools
- **Jotai/Recoil**: Atomic state management

### Charts Library
- **Recharts** (recommended): React-friendly, simple API
- **Victory**: More features, larger bundle
- **Chart.js**: Popular, but less React-integrated
- **D3.js**: Most powerful, steeper learning curve

### 3D Library
- **Three.js + React Three Fiber** (recommended): Industry standard
- **Babylon.js**: Alternative with good React support
- **A-Frame**: Simpler but less flexible

---

## Contact & Collaboration

For questions, suggestions, or contributions to this design document:
- Project Repository: [GitHub link]
- Technical Lead: [Name]
- Last Updated: [Date]

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Draft for Review