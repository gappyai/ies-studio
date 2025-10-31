export interface CSVRow {
  filename: string;
  manufacturer?: string;
  luminaireCatalogNumber?: string;
  lampCatalogNumber?: string;
  test?: string;
  testLab?: string;
  testDate?: string;
  issueDate?: string;
  lampPosition?: string;
  other?: string;
  nearField?: string;
  // Photometric update fields
  wattage?: string;
  cct?: string;
  cctMultiplier?: string;
  length?: string;
  width?: string;
  height?: string;
  unit?: string; // 'meters' or 'feet'
}

export class CSVService {
  /**
   * Parse CSV content into structured data
   */
  parseCSV(content: string): CSVRow[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: CSVRow[] = [];

    // Map headers to our expected format
    const headerMap: { [key: string]: keyof CSVRow } = {
      'filename': 'filename',
      'file name': 'filename',
      'manufacturer': 'manufacturer',
      'manufac': 'manufacturer',
      'luminairecatalognumber': 'luminaireCatalogNumber',
      'lumcat': 'luminaireCatalogNumber',
      'lampcatalognumber': 'lampCatalogNumber',
      'lampcat': 'lampCatalogNumber',
      'test': 'test',
      'testlab': 'testLab',
      'test laboratory': 'testLab',
      'testdate': 'testDate',
      'test date': 'testDate',
      'issuedate': 'issueDate',
      'issue date': 'issueDate',
      'lampposition': 'lampPosition',
      'lamp position': 'lampPosition',
      'other': 'other',
      'nearfield': 'nearField',
      'near field': 'nearField',
      'near-field': 'nearField',
      // Photometric fields
      'wattage': 'wattage',
      'watts': 'wattage',
      'power': 'wattage',
      'cct': 'cct',
      'cct (k)': 'cct',
      'colortemperature': 'cct',
      'color temperature': 'cct',
      'cctmultiplier': 'cctMultiplier',
      'cct multiplier': 'cctMultiplier',
      'multiplier': 'cctMultiplier',
      'length': 'length',
      'length (m)': 'length',
      'length (ft)': 'length',
      'width': 'width',
      'width (m)': 'width',
      'width (ft)': 'width',
      'height': 'height',
      'height (m)': 'height',
      'height (ft)': 'height',
      'unit': 'unit',
      'units': 'unit',
      'dimension unit': 'unit',
      'dimension units': 'unit'
    };

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Partial<CSVRow> = {};

      headers.forEach((header, index) => {
        const mappedField = headerMap[header];
        if (mappedField && index < values.length) {
          row[mappedField] = values[index].trim();
        }
      });

      if (row.filename) {
        rows.push(row as CSVRow);
      }
    }

    return rows;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  /**
   * Convert CSV data to CSV string
   */
  exportCSV(rows: CSVRow[], includePhotometric: boolean = false): string {
    const headers = includePhotometric
      ? ['filename', 'manufacturer', 'luminaireCatalogNumber', 'lampCatalogNumber', 'test', 'testLab', 'testDate', 'issueDate', 'lampPosition', 'other', 'nearField', 'cct', 'length', 'width', 'height', 'unit']
      : ['filename', 'manufacturer', 'luminaireCatalogNumber', 'lampCatalogNumber', 'test', 'testLab', 'testDate', 'issueDate', 'lampPosition', 'other', 'nearField'];
    
    // Create display headers
    const displayHeaders = headers.map(header => {
      if (header === 'cct') {
        return 'cct (K)';
      } else if (header === 'nearField') {
        return 'nearField';
      }
      return header;
    });
    
    const csvRows = rows.map(row => {
      return headers.map(header => {
        const value = row[header as keyof CSVRow] || '';
        // Escape commas and quotes in values
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [displayHeaders.join(','), ...csvRows].join('\n');
  }

  /**
   * Apply LEDFlex template to CSV data
   */
  applyLEDFlexTemplate(rows: CSVRow[]): CSVRow[] {
    return rows.map(row => ({
      ...row,
      manufacturer: 'LEDFLEX',
      testLab: 'LEDFLEX',
      luminaireCatalogNumber: row.luminaireCatalogNumber || `LEDFLEX-${row.filename.replace('.ies', '')}`,
      lampCatalogNumber: row.lampCatalogNumber || `LEDFLEX-${row.filename.replace('.ies', '')}`
    }));
  }

  /**
   * Generate CSV template with sample data
   */
  generateTemplate(includePhotometric: boolean = false): string {
    const templateRows: CSVRow[] = [
      {
        filename: 'example_factory_sku.ies',
        manufacturer: 'LEDFLEX',
        luminaireCatalogNumber: 'LEDFLEX-SKU-001',
        lampCatalogNumber: 'LEDFLEX-SKU-001',
        test: 'TEST-001',
        testLab: 'LEDFLEX',
        testDate: '01/15/2024',
        issueDate: '01/20/2024',
        lampPosition: 'Universal',
        other: 'Factory to LEDFlex conversion',
        nearField: '',
        ...(includePhotometric && {
          wattage: '40',
          cct: '4000',
          cctMultiplier: '1.0',
          length: '1.000',
          width: '0.050',
          height: '0.010'
        })
      }
    ];

    return this.exportCSV(templateRows, includePhotometric);
  }

  /**
   * Generate wattage update template
   */
  generateWattageTemplate(filenames: string[]): string {
    const rows: CSVRow[] = filenames.map(filename => ({
      filename,
      wattage: ''
    }));
    return this.exportCSV(rows, true);
  }

  /**
   * Generate CCT update template
   */
  generateCCTTemplate(filenames: string[], baseCCT?: string): string {
    const rows: CSVRow[] = filenames.map(filename => ({
      filename,
      cct: baseCCT || '',
      cctMultiplier: '1.0'
    }));
    return this.exportCSV(rows, true);
  }

  /**
   * Generate length update template
   */
  generateLengthTemplate(filenames: string[]): string {
    const rows: CSVRow[] = filenames.map(filename => ({
      filename,
      length: ''
    }));
    return this.exportCSV(rows, true);
  }

  /**
   * Validate CSV data
   */
  validateCSV(rows: CSVRow[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (rows.length === 0) {
      errors.push('No data rows found');
      return { isValid: false, errors };
    }

    // Check for required filename field
    rows.forEach((row, index) => {
      if (!row.filename) {
        errors.push(`Row ${index + 1}: Missing filename`);
      }
    });

    // Check for duplicate filenames
    const filenames = rows.map(row => row.filename);
    const duplicates = filenames.filter((filename, index) => 
      filenames.indexOf(filename) !== index
    );
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate filenames found: ${[...new Set(duplicates)].join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const csvService = new CSVService();