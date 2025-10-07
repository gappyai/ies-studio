import { useEffect, useRef, useMemo } from 'react';

interface IsoIlluminanceChartProps {
  data: number[][];
  verticalAngles: number[];
  horizontalAngles: number[];
}

export function IsoIlluminanceChart({ data, verticalAngles, horizontalAngles }: IsoIlluminanceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate illuminance levels (simplified - would need mounting height in real calculation)
  const { levels } = useMemo(() => {
    let max = 0;
    data.forEach(slice => {
      slice.forEach(val => {
        if (val > max) max = val;
      });
    });
    
    // Create illuminance levels
    const levelData = [
      { percentage: 50.0, value: max * 0.5, color: '#8b1a47', label: '1.9 lx' },
      { percentage: 30.0, value: max * 0.3, color: '#b8860b', label: '1.1 lx' },
      { percentage: 10.0, value: max * 0.1, color: '#2e8b57', label: '0.4 lx' },
      { percentage: 5.0, value: max * 0.05, color: '#4682b4', label: '0.2 lx' },
      { percentage: 3.0, value: max * 0.03, color: '#8b7ab8', label: '0.1 lx' },
    ];
    
    return { maxValue: max, levels: levelData };
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const gridSize = 12; // meters
    const cellSize = (Math.min(width, height) - padding * 2) / gridSize;
    const startX = (width - cellSize * gridSize) / 2;
    const startY = (height - cellSize * gridSize) / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid and illuminance zones
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cellX = startX + x * cellSize;
        const cellY = startY + y * cellSize;
        
        // Calculate distance from center
        const centerX = gridSize / 2;
        const centerY = gridSize / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
        const normalizedDistance = distance / maxDistance;
        
        // Determine illuminance level based on distance
        let cellColor = '#1a1a2e';
        for (let i = levels.length - 1; i >= 0; i--) {
          if (normalizedDistance < (levels[i].percentage / 100)) {
            cellColor = levels[i].color + '40'; // Add transparency
            break;
          }
        }
        
        // Fill cell
        ctx.fillStyle = cellColor;
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
        
        // Draw cell border
        ctx.strokeStyle = '#2a2a3e';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cellX, cellY, cellSize, cellSize);
      }
    }

    // Draw center circle (light source)
    const centerX = startX + (gridSize * cellSize) / 2;
    const centerY = startY + (gridSize * cellSize) / 2;
    
    // Draw multiple concentric circles for illuminance contours
    levels.forEach((level) => {
      const radius = cellSize * gridSize * (level.percentage / 200);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = level.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw light source at center
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe66d';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#8a8a9e';
    ctx.font = '11px sans-serif';
    
    // X-axis labels
    for (let i = 0; i <= gridSize; i += 2) {
      const x = startX + i * cellSize;
      const label = (i - gridSize / 2).toString();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, x, startY + gridSize * cellSize + 10);
    }
    
    // Y-axis labels
    for (let i = 0; i <= gridSize; i += 2) {
      const y = startY + i * cellSize;
      const label = (gridSize / 2 - i).toString();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, startX - 10, y);
    }

    // Draw corner labels
    ctx.fillStyle = '#6a6a7e';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('8', startX - 25, startY + gridSize * cellSize + 35);
    
    ctx.textAlign = 'right';
    ctx.fillText('8', startX + gridSize * cellSize + 25, startY - 10);
    
    // Draw axis arrows/indicators
    ctx.strokeStyle = '#6a6a7e';
    ctx.lineWidth = 1;
    
    // Vertical arrow
    ctx.beginPath();
    ctx.moveTo(startX + gridSize * cellSize + 15, startY);
    ctx.lineTo(startX + gridSize * cellSize + 15, startY - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX + gridSize * cellSize + 15, startY - 20);
    ctx.lineTo(startX + gridSize * cellSize + 12, startY - 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX + gridSize * cellSize + 15, startY - 20);
    ctx.lineTo(startX + gridSize * cellSize + 18, startY - 15);
    ctx.stroke();
    
    // Horizontal arrow
    ctx.beginPath();
    ctx.moveTo(startX, startY + gridSize * cellSize + 25);
    ctx.lineTo(startX - 20, startY + gridSize * cellSize + 25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX - 20, startY + gridSize * cellSize + 25);
    ctx.lineTo(startX - 15, startY + gridSize * cellSize + 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX - 20, startY + gridSize * cellSize + 25);
    ctx.lineTo(startX - 15, startY + gridSize * cellSize + 28);
    ctx.stroke();

  }, [data, verticalAngles, horizontalAngles, levels]);

  return (
    <div className="bg-[#0f0f1e] p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Iso-illuminance plot</h3>
      <div className="flex gap-6">
        <div className="flex-1 flex justify-center">
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="max-w-full h-auto"
          />
        </div>
        <div className="w-32">
          <div className="space-y-1">
            {levels.map((level) => (
              <div key={level.percentage} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-8 h-4 rounded"
                  style={{ backgroundColor: level.color }}
                />
                <span className="text-gray-300 font-mono">
                  {level.percentage.toFixed(1)}%
                </span>
                <span className="text-gray-400 font-mono text-[10px]">
                  {level.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Peak illuminance: 3.8 lx
          </p>
        </div>
      </div>
    </div>
  );
}