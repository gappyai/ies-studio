# IES Studio - User Guide

## Single File Editor

### Upload & View
- **Upload**: Drag & drop or click to select an IES file
- **Overview Tab**: View all file properties, photometric data, and calculated metrics
- **Charts Tab**: Visualize candela distribution with polar, linear, and iso-candela charts
- **3D Tab**: Interactive 3D light distribution visualization

### Editing Files
- **Edit Tab**: Modify metadata fields and photometric properties
- **Save Changes**: Click "Save Changes" to apply edits (auto-saved before download)
- **Reset**: Discard all unsaved changes and revert to original values
- **Download**: 
  - Filename defaults to Luminaire Catalog Number (LUMCAT) from metadata
  - Edit filename before downloading if needed
  - Automatically includes `.ies` extension

---

## Batch Metadata Editor

### Purpose
Edit metadata fields across multiple IES files without modifying photometric calculations.

### Getting Started
1. Upload multiple IES files (drag & drop or click)
2. Files populate in editable table with current metadata values

### Editing Data
- **Individual Cells**: Click any cell to edit directly
- **Bulk Edit**: Click column header to set the same value for all rows
- **Dimensions**: 
  - Length, Width, Height displayed with unit indicator
  - Toggle between meters and feet using the dropdown per row
  - Use "Convert All to Meters/Feet" buttons for batch unit conversion

### CSV Workflow
- **Export CSV**: Download current table as template (includes `unit` column for dimensions)
- **Upload CSV**: Import edited data
  - System validates CSV before applying
  - Preview dialog shows changes before confirmation
- **CSV Format**: Includes all metadata fields plus `unit` column (meters/feet) for dimension fields

### Special Features
- **Swap Length ⇄ Width**: Instantly swap these dimensions for all files
- **Near Field Type**: Select from dropdown (None, Point, Linear, Area)
- **CCT (K)**: Color temperature in Kelvin

### Download Settings
- **Filename Source**: 
  - **Luminaire Catalog Number** (default): Uses LUMCAT field as filename
  - **Lamp Catalog Number**: Uses lamp catalog as filename  
  - **Original Filename**: Keeps original IES filename
- Downloads as ZIP file with all processed files

---

## Batch Wattage Editor

### Purpose
Scale wattage across multiple files with automatic photometric recalculation. Lumens scale proportionally to maintain constant efficacy (lm/W).

### How It Works
- **Edit Wattage**: Changes wattage; lumens automatically calculated to maintain original efficacy
- **Preview Columns** (blue background) show calculated results:
  - Preview Lumens: Final lumen output after wattage change
  - Efficacy: Calculated lm/W ratio (remains constant)

### Workflow
1. Upload IES files
2. Table shows Original vs New values for each file
3. Click cells to edit wattage values
4. Preview columns update in real-time showing calculated lumens and efficacy
5. Changed rows highlight in blue
6. Download processed files as ZIP

### CSV Support
- **Export CSV**: Download current wattage data as template (`filename`, `wattage`)
- **Upload CSV**: Import wattage values from CSV file
  - Preview dialog shows changes before applying
  - Validates data before import

---

## Batch Lumens Editor

### Purpose
Scale lumens across multiple files with automatic photometric recalculation. Candela values scale proportionally.

### How It Works
- **Edit Lumens**: Changes lumens and scales candela values proportionally
- **Auto-Adjust Wattage** (checkbox): When enabled, automatically adjusts wattage to maintain efficacy (lm/W)
  - When checked: Both lumens and wattage scale together
  - When unchecked: Only lumens change; wattage stays constant

### Workflow
1. Upload IES files
2. Toggle "Auto-adjust wattage" checkbox as needed
3. Click cells to edit lumens values
4. **Preview Columns** (blue background) show:
   - Preview Wattage: Final wattage (updated if auto-adjust is enabled)
   - Efficacy: Calculated lm/W ratio
5. Changed rows highlight in blue
6. Download processed files as ZIP

### CSV Support
- **Export CSV**: Download current lumens data as template (`filename`, `lumens`)
- **Upload CSV**: Import lumens values from CSV file
  - Preview dialog shows changes before applying
  - Validates data before import

---

## Batch Length Editor

### Purpose
Scale linear LED fixtures by length or width dimension with linear photometric scaling.

### Understanding Linear Scaling
- **For Linear Fixtures Only**: Designed for strip lights, linear LED, etc.
- **Linear Scaling**: Power and lumens scale 1:1 with dimension
  - Example: 1m @ 10W/1000lm → 2m @ 20W/2000lm (doubles, not quadruples)
- **One Dimension**: Only the selected dimension changes; others stay constant

### Workflow
1. Upload IES files
2. Select **Dimension to Scale** (Length or Width) per row using dropdown
3. Edit **Target** value for selected dimension
4. **Preview Columns** (blue background) show:
   - Scale Factor: Multiplier being applied
   - Preview Dimensions: L/W/H after scaling
   - Preview Power & Lumens: Scaled values
5. Changed rows highlight in blue

### Unit Toggle
- Switch between Meters and Feet using toggle at top-right
- Automatically converts all dimension values when toggled

### CSV Support
- **Export CSV**: Download current length data as template (`filename`, `targetLength`)
- **Upload CSV**: Import target length values from CSV file
  - Optional `scalingDimension` column (length/width)
  - Preview dialog shows changes before applying
  - Validates data before import

### Download
Processed files include scaled photometric data matching new dimensions.

---

## CCT Batch Generator

### Purpose
Generate multiple variants of a single IES file with different CCT values and lumen multipliers.

### Workflow
1. **Upload Base File**: Single IES file to use as template
2. **Add Variants**: 
   - Click "Add Variant" button to add manually
   - Or upload CSV with CCT data
   - Enter CCT values (e.g., 2700K, 3000K, 4000K)
   - Set lumen multiplier per CCT (e.g., 0.9x, 1.0x, 1.1x)
   - Add multiple CCTs at once
3. **Edit Variant Table**:
   - **CCT (K)**: Click to edit color temperature value
   - **Catalog Number**: Click to edit; auto-updates filename
   - **Output Filename**: Manual override if needed
   - **Multiplier**: Lumen scaling factor
   - **Preview Lumens** (blue): Calculated output
4. **Download**: All variants packaged as ZIP file

### CSV Support
- **Export CSV**: Download variants as CSV template (`CCT (K)`, `Catalog Number`, `Filename`, `Multiplier`)
- **Upload CSV**: Import CCT variants from CSV file
  - Preview dialog shows changes before applying
  - Validates CCT and multiplier values
  - Automatically sets filenames from catalog numbers if provided

### Tips
- Catalog number automatically sets filename as `[catalog].ies`
- Base file includes any edits made in Single File Editor
- Each variant is a complete IES file with updated CCT metadata and scaled photometrics

---

## Common Features

### File Limits
- **Batch Operations**: Up to 1000 files per upload
- **Supported Format**: `.ies` or `.IES` files only

### Action Bar
Present on all batch pages with:
- **File Count**: Shows number of loaded files
- **Action Buttons**: Feature-specific operations (CSV Export/Import, Download, etc.)
- **Clear All**: Remove all files and reset

### Editing Tables
- **Click to Edit**: All editable cells highlight on hover
- **Enter to Confirm**: Press Enter key to save and move on
- **Visual Feedback**: Changed values appear in blue; changed rows have blue background

### CSV Export/Import
All batch pages support CSV workflows:
- **Export**: Download current data as CSV template
- **Import**: Upload edited CSV file
- **Preview**: Review changes in dialog before applying
- **Validation**: System checks data format and values before import

### Download Behavior
- All batch operations download as **ZIP files**
- Original file structure maintained
- Filename handling varies by feature (see specific sections)

---

## Tips & Best Practices

1. **Metadata Only**: Use Batch Metadata Editor for fields that don't affect light output
2. **Photometric Changes**: 
   - Use Batch Wattage Editor to change power while maintaining efficacy
   - Use Batch Lumens Editor to change light output (with optional wattage adjustment)
   - Use Batch Length Editor for linear fixtures with 1D scaling
3. **CSV Workflows**: Export → Edit in Excel/Sheets → Re-import for complex batch edits
4. **Preview Before Download**: Check preview columns to verify calculations
5. **Unit Consistency**: Convert all files to same unit system before batch operations
6. **Catalog Numbers**: Set LUMCAT for automatic, consistent filename generation
7. **Save Single File Edits**: Changes in Single File Editor carry over to CCT Batch Generator

---

## Troubleshooting

### CSV Upload Fails
- Check filename column matches uploaded files exactly
- Ensure CSV includes header row
- Verify numeric values are valid (no text in number fields)
- For dimensions: Verify unit values are "meters", "feet", "m", or "ft"

### Wrong Download Filename
- Check Download Settings (Batch Metadata Editor)
- Verify Luminaire/Lamp Catalog Number is populated
- Use "Original Filename" option if catalog numbers are blank

### Unexpected Photometric Values
- **Metadata Editor**: Only changes metadata, not photometrics
- **Wattage Editor**: Maintains efficacy; lumens scale proportionally
- **Lumens Editor**: Scales candela values; wattage may adjust if enabled
- **Length Editor**: Only for linear fixtures with 1D linear scaling

### File Won't Parse
- Ensure file is valid IES format
- Check file extension is `.ies`
- Verify file isn't corrupted or empty

---

## Quick Reference

| Task | Tool | Key Feature |
|------|------|-------------|
| View single file | Single File Editor | Overview + Charts + 3D |
| Edit one file | Single File Editor | Edit tab + Download |
| Change metadata only | Batch Metadata Editor | No photometric changes |
| Scale power (maintain efficacy) | Batch Wattage Editor | Proportional scaling |
| Scale light output | Batch Lumens Editor | Candela scaling + optional wattage adjust |
| Scale linear fixture | Batch Length Editor | 1D linear scaling |
| Create CCT family | CCT Batch Generator | Multiple variants from one file |
| Batch edit via CSV | Any batch page | Export → Edit → Import |
