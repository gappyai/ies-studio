import { useEffect, useRef, useMemo } from 'react';

interface IsoCandelaChartProps {
  data: number[][];
  verticalAngles: number[];
  horizontalAngles: number[];
}

export function IsoCandelaChart({ data, verticalAngles, horizontalAngles }: IsoCandelaChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate max intensity and contour levels
  const { contourLevels } = useMemo(() => {
    let max = 0;
    data.forEach(slice => {
      slice.forEach(val => {
        if (val > max) max = val;
      });
    });
    
    // Create 9 contour levels from 10% to 90%
    const levels = [];
    for (let i = 9; i >= 1; i--) {
      levels.push({
        percentage: i * 10,
        value: (max * i) / 10,
        color: `hsl(${240 - i * 20}, 70%, ${30 + i * 5}%)`,
      });
    }
    
    return { maxIntensity: max, contourLevels: levels };
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;
    const chartSize = Math.min(width, height) - padding * 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = chartSize / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, width, height);

    // Create polar grid with intensity values
    const angleStep = Math.PI / 18; // 10 degree steps
    const radiusSteps = 10;

    // Draw contour fills
    contourLevels.forEach((level) => {
      ctx.beginPath();
      let firstPoint = true;
      
      for (let angle = 0; angle <= Math.PI * 2; angle += angleStep) {
        // Map angle to horizontal angle index
        const hAngleDeg = (angle * 180) / Math.PI;
        let hIndex = 0;
        for (let i = 0; i < horizontalAngles.length; i++) {
          if (Math.abs(horizontalAngles[i] - hAngleDeg) < Math.abs(horizontalAngles[hIndex] - hAngleDeg)) {
            hIndex = i;
          }
        }
        
        const slice = data[hIndex] || [];
        
        // Find the radius where intensity matches this level
        let levelRadius = 0;
        for (let vIdx = 0; vIdx < slice.length; vIdx++) {
          const intensity = slice[vIdx];
          if (intensity >= level.value) {
            const vAngle = verticalAngles[vIdx] || 0;
            levelRadius = (vAngle / 90) * radius;
          }
        }
        
        const x = centerX + Math.cos(angle - Math.PI / 2) * levelRadius;
        const y = centerY + Math.sin(angle - Math.PI / 2) * levelRadius;
        
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.fillStyle = level.color;
      ctx.fill();
    });

    // Draw grid circles
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    for (let i = 1; i <= radiusSteps; i++) {
      const r = (radius / radiusSteps) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw angle label
      if (i === radiusSteps) {
        ctx.fillStyle = '#6a6a7e';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const angle = (i * 90) / radiusSteps;
        ctx.fillText(`${angle}°`, centerX - r - 15, centerY);
      }
    }

    // Draw radial lines
    for (let angle = 0; angle < 360; angle += 30) {
      const rad = (angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(rad - Math.PI / 2) * radius,
        centerY + Math.sin(rad - Math.PI / 2) * radius
      );
      ctx.stroke();
      
      // Angle labels
      const labelRadius = radius + 20;
      const x = centerX + Math.cos(rad - Math.PI / 2) * labelRadius;
      const y = centerY + Math.sin(rad - Math.PI / 2) * labelRadius;
      ctx.fillStyle = '#8a8a9e';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${angle}°`, x, y);
    }

    // Draw corner labels
    ctx.fillStyle = '#8a8a9e';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('C45', 10, 10);
    ctx.textAlign = 'right';
    ctx.fillText('C315', width - 10, 10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('C135', 10, height - 10);
    ctx.textAlign = 'right';
    ctx.fillText('C225', width - 10, height - 10);

  }, [data, verticalAngles, horizontalAngles, contourLevels]);

  return (
    <div className="bg-[#0f0f1e] p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Iso-candela plot</h3>
      <div className="flex gap-6">
        <div className="flex-1 flex justify-center">
          <canvas
            ref={canvasRef}
            width={500}
            height={500}
            className="max-w-full h-auto"
          />
        </div>
        <div className="w-32">
          <div className="space-y-1">
            {contourLevels.map((level) => (
              <div key={level.percentage} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-8 h-4 rounded"
                  style={{ backgroundColor: level.color }}
                />
                <span className="text-gray-300 font-mono">
                  {level.percentage}%
                </span>
                <span className="text-gray-400 font-mono text-[10px]">
                  {level.value.toFixed(1)} cd
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}