# IES Studio

A modern web application for viewing, editing, and managing IES (Illuminating Engineering Society) photometric files.

## Features

- 📁 **File Upload**: Drag-and-drop or browse IES files
- 📊 **Overview**: View photometric data with key metrics
- ✏️ **Edit**: Modify luminaire properties and photometric data
- 🎨 **3D Visualization**: Interactive 3D light distribution (coming soon)
- 🔄 **Batch Generator**: Create multiple variant files from a base IES file
- 💾 **Export**: Download edited IES files

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management
- **Recharts** for data visualization

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Buttons, inputs, modals
│   ├── charts/         # Visualization components
│   ├── layout/         # Header, sidebar, layout
│   └── file-upload/    # File handling components
├── pages/              # Route-based page components
│   ├── HomePage.tsx
│   ├── OverviewPage.tsx
│   ├── EditPage.tsx
│   ├── View3DPage.tsx
│   ├── BatchGeneratorPage.tsx
│   └── ExportPage.tsx
├── services/           # Business logic
│   ├── iesParser.ts    # IES file parsing
│   ├── calculator.ts   # Photometric calculations
│   └── batchGenerator.ts
├── store/              # State management
│   └── iesFileStore.ts
├── types/              # TypeScript definitions
│   └── ies.types.ts
├── utils/              # Helper functions
└── hooks/              # Custom React hooks
```

## Sample Files

Sample IES files are included in the `/sample_files` directory for testing:
- `LL80272009_.IES`
- `RO40W4030206S_.ies`
- `UN10TV274_.IES`
- `UN16TVRGB12_.IES`

## Development Roadmap

### Phase 1 (Current)
- [x] Project setup
- [x] File upload functionality
- [x] Basic layout and navigation
- [x] IES parser
- [x] Overview page with key metrics
- [ ] Chart visualizations (Polar, Linear, Iso-candela plots)
- [ ] Edit page with forms
- [ ] 3D visualization
- [ ] Batch generator
- [ ] Export functionality

### Phase 2 (Future)
- PDF report generation
- LDT file format support
- Advanced calculations (UGR tables)
- File comparison tool
- Cloud storage integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For questions or issues, please open an issue on GitHub.
