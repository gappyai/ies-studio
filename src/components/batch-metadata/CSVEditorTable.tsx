import { useState } from 'react';
import type { CSVRow } from '../../services/csvService';
import type { ExtendedCSVRow } from '../../hooks/useCSVData';

interface CSVEditorTableProps {
  csvData: ExtendedCSVRow[];
  csvHeaders: (keyof CSVRow)[];
  onCellUpdate: (rowIndex: number, field: keyof CSVRow, value: string) => void;
  onUnitChange: (rowIndex: number, unit: 'meters' | 'feet') => void;
  onBulkEdit: (field: keyof CSVRow) => void;
  autoAdjustWattage?: boolean;
}

export function CSVEditorTable({
  csvData,
  csvHeaders,
  onCellUpdate,
  onUnitChange,
  onBulkEdit
}: CSVEditorTableProps) {
  const [editingCell, setEditingCell] = useState<{row: number, field: keyof CSVRow, value: string} | null>(null);
  
  const getColumnDisplayName = (header: keyof CSVRow): string => {
    let displayHeader = header.replace(/([A-Z])/g, ' $1').trim();
    if (header === 'cct') {
      displayHeader = 'CCT (K)';
    } else if (header === 'nearField') {
      displayHeader = 'Near Field Type';
    } else if (header === 'wattage') {
      displayHeader = 'Wattage (W)';
    } else if (header === 'lumens') {
      displayHeader = 'Lumens (lm)';
    }
    return displayHeader;
  };

  const commitEdit = () => {
    if (editingCell) {
        // Only trigger update if value actually changed or it's empty vs undefined
        // Note: We need to compare with the original row value to avoid redundant updates
        // But we don't have easy access to the specific row data here without finding it again or passing it.
        // Actually we do have csvData.
        
        const currentRow = csvData[editingCell.row];
        const currentValue = currentRow[editingCell.field] || '';
        
        if (editingCell.value !== currentValue) {
            onCellUpdate(editingCell.row, editingCell.field, editingCell.value);
        }
        setEditingCell(null);
    }
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {csvHeaders.map((header) => {
              const displayHeader = getColumnDisplayName(header);
              const isDimensionField = header === 'length' || header === 'width' || header === 'height';
              
              return (
                <th
                  key={header}
                  onClick={() => header !== 'filename' && onBulkEdit(header)}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    header !== 'filename' ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  title={header !== 'filename' ? 'Click to set value for all rows' : ''}
                >
                  {isDimensionField ? displayHeader.replace(/\s*\(.*\)/, '') : displayHeader}
                </th>
              );
            })}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {csvData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {csvHeaders.map((header) => {
                const isWattage = header === 'wattage';
                const isLumens = header === 'lumens';
                const wattageChanged = isWattage && row.originalWattage !== undefined && 
                  Math.abs(parseFloat(row.wattage || '0') - row.originalWattage) > 0.01;
                const lumensChanged = isLumens && row.originalLumens !== undefined && 
                  Math.abs(parseFloat(row.lumens || '0') - row.originalLumens) > 0.1;
                
                const isEditing = editingCell?.row === rowIndex && editingCell?.field === header;

                return (
                  <td key={header} className={`px-4 py-2 ${(wattageChanged || lumensChanged) ? 'bg-blue-50' : ''}`}>
                    {isEditing ? (
                      header === 'nearField' ? (
                        <select
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                          onBlur={commitEdit}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        >
                          <option value="">None</option>
                          <option value="1">1 - Point</option>
                          <option value="2">2 - Linear</option>
                          <option value="3">3 - Area</option>
                        </select>
                      ) : isWattage || isLumens ? (
                        <input
                          type="number"
                          step="any"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              commitEdit();
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <input
                          type="text"
                          value={editingCell.value}
                          onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              commitEdit();
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        />
                      )
                    ) : (
                      <div
                        onClick={() => setEditingCell({row: rowIndex, field: header, value: row[header] || ''})}
                        className={`px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm ${
                          wattageChanged || lumensChanged ? 'font-medium text-blue-700' : ''
                        }`}
                      >
                        {row[header] || '-'}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-2">
                <select
                  value={row.unit || 'meters'}
                  onChange={(e) => onUnitChange(rowIndex, e.target.value as 'meters' | 'feet')}
                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="meters">m</option>
                  <option value="feet">ft</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

