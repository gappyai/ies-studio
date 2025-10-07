import { useEffect, useRef, useMemo } from 'react';

interface LinearChartProps {
  data: number[][];
  verticalAngles: number[];
  horizontalAngles: number[];
}

export function LinearChart({ data, verticalAngles, horizontalAngles }: LinearChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate max intensity for normalization
  const maxIntensity = useMemo(() => {
    let max = 0;
    data.forEach(slice => {
      slice.forEach(val => {
        if (val > max) max = val;
      });
    });
    return max;
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 120, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      
      // Y-axis labels (intensity)
      const intensity = maxIntensity * (1 - i / 5);
      ctx.fillStyle = '#888899';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(intensity.toFixed(0), padding.left - 10, y);
    }
    
    // Vertical grid lines
    const angleStep = Math.ceil(verticalAngles.length / 10);
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (chartWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
      
      // X-axis labels (angles)
      const angleIndex = i * angleStep;
      if (angleIndex < verticalAngles.length) {
        const angle = verticalAngles[angleIndex];
        ctx.fillStyle = '#888899';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${angle}°`, x, padding.top + chartHeight + 10);
      }
    }

    // Draw axis labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Intensity (cd)', padding.left + chartWidth / 2, padding.top + chartHeight + 45);

    ctx.save();
    ctx.translate(15, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Candela (cd)', 0, 0);
    ctx.restore();

    // Plot lines for different horizontal angles
    const colors = [
      { color: 'rgba(255, 107, 107, 0.9)', label: 'C0/C180', stroke: '#ff6b6b' },
      { color: 'rgba(255, 195, 113, 0.9)', label: 'C90/C270', stroke: '#ffc371' },
    ];

    const planesToPlot = [
      0, // C0/C180
      horizontalAngles.length > 1 ? Math.floor(horizontalAngles.length / 2) : 0, // C90/C270
    ];

    planesToPlot.forEach((planeIndex, idx) => {
      const slice = data[planeIndex] || [];
      const colorInfo = colors[idx] || colors[0];
      
      // Create gradient for fill
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      gradient.addColorStop(0, colorInfo.color);
      gradient.addColorStop(1, 'rgba(26, 26, 46, 0.1)');
      
      ctx.beginPath();
      
      // Start from bottom left
      ctx.moveTo(padding.left, padding.top + chartHeight);
      
      // Draw the curve
      slice.forEach((intensity, vIdx) => {
        const x = padding.left + (chartWidth / (slice.length - 1)) * vIdx;
        const normalizedIntensity = intensity / maxIntensity;
        const y = padding.top + chartHeight * (1 - normalizedIntensity);
        
        if (vIdx === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      // Close path to bottom right
      ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
      ctx.closePath();
      
      // Fill with gradient
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw line on top
      ctx.beginPath();
      slice.forEach((intensity, vIdx) => {
        const x = padding.left + (chartWidth / (slice.length - 1)) * vIdx;
        const normalizedIntensity = intensity / maxIntensity;
        const y = padding.top + chartHeight * (1 - normalizedIntensity);
        
        if (vIdx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.strokeStyle = colorInfo.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw legend
    const legendX = padding.left + chartWidth + 20;
    let legendY = padding.top + 10;
    
    colors.forEach((colorInfo, idx) => {
      if (idx < planesToPlot.length) {
        // Legend color box
        ctx.fillStyle = colorInfo.color;
        ctx.fillRect(legendX, legendY, 20, 12);
        ctx.strokeStyle = colorInfo.stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, 20, 12);
        
        // Legend text
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(colorInfo.label, legendX + 25, legendY + 6);
        
        legendY += 25;
      }
    });

  }, [data, verticalAngles, horizontalAngles, maxIntensity]);

  return (
    <div className="bg-[#1a1a2e] p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Linear plot</h3>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="max-w-full h-auto"
        />
      </div>
      <p className="text-sm text-gray-400 mt-2 text-center">
        Intensity distribution across vertical angles for different horizontal planes
      </p>
    </div>
  );
}